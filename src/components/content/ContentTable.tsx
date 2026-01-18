import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Filter, SortAsc, SortDesc, Download, Sparkles, 
  ExternalLink, Youtube, Send, Instagram, Globe, ChevronLeft, ChevronRight,
  Eye, Trash2, MoreHorizontal, RefreshCw
} from 'lucide-react';
import { ContentDetailModal } from './ContentDetailModal';
import { ContentSource, ContentStatus } from '@/types/content';
import { DbParsedContent } from '@/hooks/useParsedContent';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sourceIcons: Record<ContentSource, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceColors: Record<ContentSource, string> = {
  youtube: 'text-red-400 bg-red-500/20',
  telegram: 'text-blue-400 bg-blue-500/20',
  instagram: 'text-pink-400 bg-pink-500/20',
  web: 'text-emerald-400 bg-emerald-500/20',
};

const statusColors: Record<ContentStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  parsed: 'bg-info/20 text-info',
  rewritten: 'bg-primary/20 text-primary',
  video_created: 'bg-accent/20 text-accent',
  published: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<ContentStatus, string> = {
  pending: 'Ожидает',
  parsed: 'Спарсен',
  rewritten: 'Переписан',
  video_created: 'Видео',
  published: 'Опубликован',
  failed: 'Ошибка',
};

interface ContentTableProps {
  items: DbParsedContent[];
  onSelect?: (ids: string[]) => void;
  onRewrite?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (ids: string[]) => void;
  onClearAll?: () => void;
  onRefresh?: () => void;
  selectedIds?: string[];
}

export function ContentTable({ 
  items, 
  onSelect, 
  onRewrite, 
  onView,
  onDelete,
  onClearAll,
  onRefresh,
  selectedIds = [] 
}: ContentTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ContentSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DbParsedContent['status'] | 'all'>('all');
  const [relevanceFilter, setRelevanceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortField, setSortField] = useState<'published_at' | 'parsed_at' | 'engagement_score' | 'relevance_score'>('parsed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DbParsedContent | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();

  const handleOpenDetail = (item: DbParsedContent) => {
    setDetailItem(item);
    setDetailModalOpen(true);
  };

  const handleRecalculateRelevance = async () => {
    setIsRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-relevance');
      
      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Пересчёт завершён',
          description: `${data.message}. Высокая: ${data.stats?.highRelevance}, Средняя: ${data.stats?.mediumRelevance}, Низкая: ${data.stats?.lowRelevance}`
        });
        onRefresh?.();
      } else {
        throw new Error(data?.error || 'Ошибка пересчёта');
      }
    } catch (error) {
      console.error('Recalculate error:', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось пересчитать релевантность',
        variant: 'destructive'
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.content?.toLowerCase().includes(q)) ||
        (item.channels?.name?.toLowerCase().includes(q))
      );
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter(item => {
        // For web source, include items without channel (manually added)
        if (sourceFilter === 'web') {
          return item.channels?.source === 'web' || !item.channels;
        }
        return item.channels?.source === sourceFilter;
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Filter by relevance
    if (relevanceFilter !== 'all') {
      result = result.filter(item => {
        const score = item.relevance_score || 0;
        if (relevanceFilter === 'high') return score >= 70;
        if (relevanceFilter === 'medium') return score >= 40 && score < 70;
        return score < 40;
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA: number, valB: number;
      if (sortField === 'engagement_score') {
        valA = a.engagement_score || 0;
        valB = b.engagement_score || 0;
      } else if (sortField === 'relevance_score') {
        valA = a.relevance_score || 0;
        valB = b.relevance_score || 0;
      } else {
        valA = new Date(a[sortField] || 0).getTime();
        valB = new Date(b[sortField] || 0).getTime();
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [items, searchQuery, sourceFilter, statusFilter, relevanceFilter, sortField, sortOrder]);

  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const allSelected = paginatedItems.length > 0 && paginatedItems.every(item => selectedIds.includes(item.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelect?.(selectedIds.filter(id => !paginatedItems.find(item => item.id === id)));
    } else {
      const newIds = [...new Set([...selectedIds, ...paginatedItems.map(item => item.id)])];
      onSelect?.(newIds);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect?.(selectedIds.filter(i => i !== id));
    } else {
      onSelect?.([...selectedIds, id]);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Stats
  const stats = {
    total: items.length,
    bySource: Object.entries(
      items.reduce((acc, item) => {
        const source = item.channels?.source || 'web';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ),
    today: items.filter(item => {
      const today = new Date();
      const parsed = new Date(item.parsed_at);
      return parsed.toDateString() === today.toDateString();
    }).length,
    highRelevance: items.filter(item => (item.relevance_score || 0) >= 70).length,
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 70) return 'bg-success/20 text-success';
    if (score >= 40) return 'bg-warning/20 text-warning';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="rounded-xl card-gradient border border-border overflow-hidden">
      {/* Header & Stats */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">Спарсенный контент</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Всего: <span className="text-foreground font-medium">{stats.total}</span></span>
              <span>•</span>
              <span>Сегодня: <span className="text-success font-medium">{stats.today}</span></span>
              <span>•</span>
              <span>Релевантных: <span className="text-success font-medium">{stats.highRelevance}</span></span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Выбрано: {selectedIds.length}
                </span>
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => onRewrite?.(selectedIds[0])}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Рерайт ({selectedIds.length})
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Удалить
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить {selectedIds.length} элементов?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие нельзя отменить. Выбранный контент будет удален навсегда.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete?.(selectedIds)}>
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRecalculateRelevance}
                  disabled={isRecalculating || items.length === 0}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-1", isRecalculating && "animate-spin")} />
                  {isRecalculating ? 'Пересчёт...' : 'Пересчитать релевантность'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={items.length === 0}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Очистить всё
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Очистить весь контент?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Будет удалено {items.length} элементов. Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={onClearAll}>
                        Очистить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, контенту, каналу..."
              className="pl-9 bg-secondary/50"
            />
          </div>

          <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as ContentSource | 'all')}>
            <SelectTrigger className="w-36 bg-secondary/50">
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

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as DbParsedContent['status'] | 'all')}>
            <SelectTrigger className="w-36 bg-secondary/50">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="parsed">Спарсен</SelectItem>
              <SelectItem value="selected">Выбран</SelectItem>
              <SelectItem value="rewriting">Рерайт...</SelectItem>
              <SelectItem value="rewritten">Переписан</SelectItem>
              <SelectItem value="voiceover">Озвучка</SelectItem>
              <SelectItem value="video">Видео</SelectItem>
              <SelectItem value="published">Опубликован</SelectItem>
            </SelectContent>
          </Select>

          <Select value={relevanceFilter} onValueChange={v => setRelevanceFilter(v as 'all' | 'high' | 'medium' | 'low')}>
            <SelectTrigger className="w-40 bg-secondary/50">
              <SelectValue placeholder="Релевантность" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Вся релевантность</SelectItem>
              <SelectItem value="high">🟢 Высокая (70+)</SelectItem>
              <SelectItem value="medium">🟡 Средняя (40-69)</SelectItem>
              <SelectItem value="low">🔴 Низкая (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-muted-foreground"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium">Источник</th>
              <th className="px-4 py-3 text-left font-medium">Название</th>
              <th className="px-4 py-3 text-left font-medium">Канал</th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  onClick={() => toggleSort('published_at')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Публикация
                  {sortField === 'published_at' && (
                    sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  onClick={() => toggleSort('parsed_at')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Спарсено
                  {sortField === 'parsed_at' && (
                    sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <button
                  onClick={() => toggleSort('relevance_score')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Релевант.
                  {sortField === 'relevance_score' && (
                    sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <button
                  onClick={() => toggleSort('engagement_score')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Engage
                  {sortField === 'engagement_score' && (
                    sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedItems.map((item, index) => {
              const source = (item.channels?.source || 'web') as ContentSource;
              const SourceIcon = sourceIcons[source];
              const isSelected = selectedIds.includes(item.id);
              const relevanceScore = item.relevance_score || 0;
              const matchedKeywords = (item.matched_keywords as string[]) || [];
              
              // Map DB status to display status
              const displayStatus = item.status as ContentStatus;
              const statusLabel = {
                parsed: 'Спарсен',
                selected: 'Выбран',
                rewriting: 'Рерайт...',
                rewritten: 'Переписан',
                voiceover: 'Озвучка',
                video: 'Видео',
                published: 'Опубликован'
              }[item.status] || item.status;
              
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/20 transition-colors animate-fade-in",
                    isSelected && "bg-primary/5"
                  )}
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleSelectOne(item.id)}
                      className="border-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded", sourceColors[source])}>
                      <SourceIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium capitalize">{source}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenDetail(item)}
                        className="font-medium truncate text-left hover:text-primary hover:underline cursor-pointer"
                        title={item.title}
                      >
                        {item.title}
                      </button>
                      {item.original_url && (
                        <a
                          href={item.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {(item.engagement_score || 0) >= 8 && (
                        <Badge className="bg-warning/20 text-warning text-xs shrink-0">🔥</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate" title={item.content || ''}>
                      {item.content?.substring(0, 100) || 'Нет описания'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    @{item.channels?.name || 'Неизвестно'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.published_at ? format(new Date(item.published_at), 'dd.MM.yy HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(item.parsed_at), { addSuffix: true, locale: ru })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold cursor-help",
                          getRelevanceColor(relevanceScore)
                        )}>
                          {Math.round(relevanceScore)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">
                          {matchedKeywords.length > 0 
                            ? `Ключевые слова: ${matchedKeywords.slice(0, 5).join(', ')}${matchedKeywords.length > 5 ? '...' : ''}`
                            : 'Нет совпадений'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                      (item.engagement_score || 0) >= 8 ? "bg-success/20 text-success" :
                      (item.engagement_score || 0) >= 5 ? "bg-warning/20 text-warning" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {item.engagement_score || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn("text-xs", statusColors[displayStatus] || 'bg-muted text-muted-foreground')}>
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDetail(item)}
                        title="Просмотр"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/20"
                        onClick={() => onRewrite?.(item.id)}
                        title="Рерайт"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => onDelete?.([item.id])}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Контент не найден</p>
                </td>
              </tr>
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

      {/* Content Detail Modal */}
      <ContentDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        item={detailItem}
        onRewrite={onRewrite}
        onUpdate={onRefresh}
      />
    </div>
  );
}
