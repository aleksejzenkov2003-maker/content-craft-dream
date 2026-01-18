import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, SortAsc, SortDesc, LayoutGrid, List, Sparkles, Filter } from 'lucide-react';
import { RewriteCard } from './RewriteCard';
import { RewrittenContentItem, useRewrittenContent } from '@/hooks/useRewrittenContent';
import { DateRangeFilter } from '@/components/content/DateRangeFilter';
import { usePrompts } from '@/hooks/usePrompts';

interface RewriteResultsCardsProps {
  onCreateVoiceover?: (rewriteId: string) => void;
}

export function RewriteResultsCards({ onCreateVoiceover }: RewriteResultsCardsProps) {
  const { content, loading, fetchContent, deleteRewrite, updateRewrite } = useRewrittenContent();
  const { prompts } = usePrompts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [promptFilter, setPromptFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch with filters
  useMemo(() => {
    fetchContent({
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
      promptId: promptFilter !== 'all' ? promptFilter : undefined,
      dateFrom,
      dateTo,
    });
  }, [sourceFilter, promptFilter, dateFrom, dateTo]);

  // Client-side filtering for search
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

  const handleDateChange = (from: Date | undefined, to: Date | undefined) => {
    setDateFrom(from);
    setDateTo(to);
  };

  // Stats
  const stats = {
    total: content.length,
    today: content.filter(item => {
      const today = new Date();
      const created = new Date(item.created_at);
      return created.toDateString() === today.toDateString();
    }).length,
  };

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">Результаты рерайта</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Всего: <span className="text-foreground font-medium">{stats.total}</span></span>
            <span>•</span>
            <span>Сегодня: <span className="text-success font-medium">{stats.today}</span></span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'desc' ? <SortDesc className="w-4 h-4 mr-2" /> : <SortAsc className="w-4 h-4 mr-2" />}
          {sortOrder === 'desc' ? 'Сначала новые' : 'Сначала старые'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по тексту..."
            className="pl-9 bg-background"
          />
        </div>

        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40 bg-background">
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
          <SelectTrigger className="w-40 bg-background">
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

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Sparkles className="w-8 h-8 animate-pulse text-primary mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Filter className="w-10 h-10 mb-4 opacity-50" />
          <p>Результаты не найдены</p>
          <p className="text-sm">Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <RewriteCard
                item={item}
                onUpdate={updateRewrite}
                onDelete={deleteRewrite}
                onCreateVoiceover={onCreateVoiceover}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
