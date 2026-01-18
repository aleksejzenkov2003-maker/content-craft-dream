import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, SortAsc, SortDesc, 
  Youtube, Send, Instagram, Globe, ChevronLeft, ChevronRight,
  Eye, Video, Sparkles, Filter
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RewrittenContentItem, useRewrittenContent } from '@/hooks/useRewrittenContent';
import { DateRangeFilter } from './DateRangeFilter';
import { RewriteDetailModal } from './RewriteDetailModal';
import { usePrompts } from '@/hooks/usePrompts';

const sourceIcons: Record<string, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceColors: Record<string, string> = {
  youtube: 'text-red-400 bg-red-500/20',
  telegram: 'text-blue-400 bg-blue-500/20',
  instagram: 'text-pink-400 bg-pink-500/20',
  web: 'text-emerald-400 bg-emerald-500/20',
};

interface RewriteResultsTableProps {
  onCreateVideo?: (script: string) => void;
}

export function RewriteResultsTable({ onCreateVideo }: RewriteResultsTableProps) {
  const { content, loading, fetchContent, deleteRewrite, updateRewrite } = useRewrittenContent();
  const { prompts } = usePrompts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [promptFilter, setPromptFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<RewrittenContentItem | null>(null);
  const pageSize = 10;

  // Fetch with filters
  const handleFilterChange = () => {
    fetchContent({
      search: searchQuery || undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
      promptId: promptFilter !== 'all' ? promptFilter : undefined,
      dateFrom,
      dateTo,
    });
  };

  // Apply filters on change
  useMemo(() => {
    handleFilterChange();
  }, [sourceFilter, promptFilter, dateFrom, dateTo]);

  // Client-side filtering for search (debounced would be better in production)
  const filteredItems = useMemo(() => {
    let result = [...content];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.rewritten_text?.toLowerCase().includes(q) ||
        item.hook?.toLowerCase().includes(q) ||
        item.parsed_content?.title?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      const valA = new Date(a.created_at).getTime();
      const valB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [content, searchQuery, sortOrder]);

  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  // Stats
  const stats = {
    total: content.length,
    today: content.filter(item => {
      const today = new Date();
      const created = new Date(item.created_at);
      return created.toDateString() === today.toDateString();
    }).length,
  };

  const handleDateChange = (from: Date | undefined, to: Date | undefined) => {
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <>
      <div className="rounded-xl card-gradient border border-border overflow-hidden">
        {/* Header & Stats */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Результаты рерайта</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Всего: <span className="text-foreground font-medium">{stats.total}</span></span>
                <span>•</span>
                <span>Сегодня: <span className="text-success font-medium">{stats.today}</span></span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по тексту..."
                className="pl-9 bg-secondary/50"
              />
            </div>

            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={handleDateChange}
            />

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-40 bg-secondary/50">
                <SelectValue placeholder="Источник" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="web">Web</SelectItem>
              </SelectContent>
            </Select>

            <Select value={promptFilter} onValueChange={setPromptFilter}>
              <SelectTrigger className="w-40 bg-secondary/50">
                <SelectValue placeholder="Промпт" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все промпты</SelectItem>
                {prompts.map(prompt => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Источник</th>
                <th className="px-4 py-3 text-left font-medium">Оригинал</th>
                <th className="px-4 py-3 text-left font-medium">Хук</th>
                <th className="px-4 py-3 text-left font-medium">Промпт</th>
                <th className="px-4 py-3 text-left font-medium">
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Дата
                    {sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 animate-pulse text-primary" />
                    <p className="text-muted-foreground">Загрузка...</p>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Результаты не найдены</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const source = item.parsed_content?.channels?.source || 'web';
                  const SourceIcon = sourceIcons[source] || Globe;
                  
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded", sourceColors[source])}>
                          <SourceIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium capitalize">{source}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[250px]">
                        <span className="font-medium truncate block" title={item.parsed_content?.title || ''}>
                          {item.parsed_content?.title || 'Без названия'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{item.parsed_content?.channels?.name || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm truncate" title={item.hook || ''}>
                          {item.hook || item.rewritten_text?.substring(0, 60) + '...' || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.prompt?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div>{format(new Date(item.created_at), 'dd.MM.yy HH:mm')}</div>
                        <div className="text-xs">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ru })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/20"
                            onClick={() => {
                              onCreateVideo?.(item.rewritten_text || item.script || '');
                            }}
                          >
                            <Video className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">
              Показано {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredItems.length)} из {filteredItems.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <RewriteDetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        onUpdate={updateRewrite}
        onDelete={deleteRewrite}
        onCreateVideo={onCreateVideo}
      />
    </>
  );
}
