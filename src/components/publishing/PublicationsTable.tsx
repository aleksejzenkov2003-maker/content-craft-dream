import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MoreVertical, Trash2, ExternalLink, Send, Sparkles, Loader2, RefreshCw,
  FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Edit2, Clock, Clapperboard, Settings2,
  Video as VideoIcon, FileText, Eye, Square,
} from 'lucide-react';
import { Publication, usePublications } from '@/hooks/usePublications';
import { toast } from 'sonner';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { useVideos } from '@/hooks/useVideos';
import { format, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CsvImporter, Lookups } from '@/components/import/CsvImporter';
import { PUBLICATION_COLUMN_MAPPING, PUBLICATION_PREVIEW_COLUMNS, PUBLICATION_FIELD_DEFINITIONS } from '@/components/import/importConfigs';
import { InlineEdit } from '@/components/ui/inline-edit';
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { PublicationFilters, PublicationFilterState } from './PublicationFilters';
import { PublicationEditDialog } from './PublicationEditDialog';
import { useVideoConcat } from '@/hooks/useVideoConcat';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatFileSize, resolvePublicationVideoMetadata } from './videoMetadata';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Не опубликовано', variant: 'secondary' },
  checked: { label: 'Не опубликовано', variant: 'secondary' },
  needs_concat: { label: 'Не опубликовано', variant: 'secondary' },
  concatenating: { label: 'Не опубликовано', variant: 'secondary' },
  scheduled: { label: 'Не опубликовано', variant: 'secondary' },
  published: { label: 'Опубликовано', variant: 'default' },
  error: { label: 'Ошибка', variant: 'destructive' },
  failed: { label: 'Ошибка', variant: 'destructive' },
};

const statusOptions = [
  { value: 'pending', label: 'Не опубликовано' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'failed', label: 'Ошибка' },
];

const syncedVideoDurationIds = new Set<string>();

type SortColumn = 'post_date' | 'views' | 'likes' | 'video_number';
type SortDirection = 'asc' | 'desc';

interface PublicationsTableProps {
  groupBy?: 'channel' | 'question';
}

function formatVideoDuration(duration: number | null | undefined) {
  if (!duration || !Number.isFinite(duration)) return '—';
  const totalSeconds = Math.round(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function PublicationDurationCell({
  duration,
  videoUrl,
  audioUrl,
  videoId,
}: {
  duration: number | null | undefined;
  videoUrl?: string | null;
  audioUrl?: string | null;
  videoId?: string | null;
}) {
  const [resolvedDuration, setResolvedDuration] = useState<number | null>(duration ?? null);

  useEffect(() => {
    let cancelled = false;
    setResolvedDuration(duration ?? null);

    if (duration || (!videoUrl && !audioUrl)) return;

    void resolvePublicationVideoMetadata({ videoUrl, audioUrl }).then(({ durationSeconds }) => {
      if (cancelled || !durationSeconds || durationSeconds <= 0) return;

      const roundedDuration = Math.round(durationSeconds);
      setResolvedDuration(roundedDuration);

      if (videoId && !syncedVideoDurationIds.has(videoId)) {
        syncedVideoDurationIds.add(videoId);
        void supabase.from('videos').update({ video_duration: roundedDuration }).eq('id', videoId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [duration, videoUrl, audioUrl, videoId]);

  return <span className={resolvedDuration ? '' : 'text-muted-foreground'}>{formatVideoDuration(resolvedDuration)}</span>;
}

function PublicationSizeCell({
  videoUrl,
}: {
  videoUrl?: string | null;
}) {
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSizeBytes(null);

    if (!videoUrl) return;

    void resolvePublicationVideoMetadata({ videoUrl }).then(({ sizeBytes: nextSizeBytes }) => {
      if (cancelled) return;
      setSizeBytes(nextSizeBytes ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  return <span className={sizeBytes ? '' : 'text-muted-foreground'}>{formatFileSize(sizeBytes)}</span>;
}

export function PublicationsTable({ groupBy = 'channel' }: PublicationsTableProps) {
  const { publications, loading, deletePublication, generateText, updatePublication, bulkImport, refetch } = usePublications();
  const { channels } = usePublishingChannels();
  const { videos } = useVideos();
  const { concatVideos, cancelConcat } = useVideoConcat();
  const [concatingId, setConcatingId] = useState<string | null>(null);
  
  const [showImporter, setShowImporter] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeStatusTab, setActiveStatusTab] = useState<string | null>(null);
  
  // Edit dialog
  const [editingPublicationId, setEditingPublicationId] = useState<string | null>(null);
  const editingPublication = publications.find(p => p.id === editingPublicationId) || null;
  
  // Inline preview dialogs
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  
  // Bulk date dialog
  const [showBulkDateDialog, setShowBulkDateDialog] = useState(false);
  const [bulkDate, setBulkDate] = useState<Date | undefined>();
  const [bulkHour, setBulkHour] = useState(12);
  const [bulkMinute, setBulkMinute] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState<PublicationFilterState>({
    statuses: [],
    channelIds: [],
    hasGeneratedText: null,
    dateRange: { from: null, to: null },
  });
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

const hours = Array.from({ length: 24 }, (_, i) => i);
const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const hasReadyText = (pub: Publication) => Boolean(pub.generated_text?.trim());

  const requiresConcat = (pub: Publication) => {
    // Use joined channel data first, fallback to channelsById
    const backCoverUrl = pub.channel?.back_cover_video_url || (pub.channel_id ? channelsById.get(pub.channel_id)?.back_cover_video_url : undefined);
    return !!backCoverUrl;
  };

  const isConcatReady = (pub: Publication) => !requiresConcat(pub) || !!pub.final_video_url;

  const isStaleConcatenating = (pub: Publication) => {
    if (pub.publication_status !== 'concatenating' || pub.final_video_url) return false;
    const updatedAt = new Date(pub.updated_at).getTime();
    if (!Number.isFinite(updatedAt)) return false;
    return Date.now() - updatedAt > 2 * 60 * 1000;
  };

  // Apply filters
  const filteredPublications = useMemo(() => {
    return publications.filter((pub) => {
      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(pub.publication_status)) {
        return false;
      }
      // Channel filter
      if (filters.channelIds.length > 0 && pub.channel_id && !filters.channelIds.includes(pub.channel_id)) {
        return false;
      }
      // Generated text filter
      if (filters.hasGeneratedText === true && !pub.generated_text) {
        return false;
      }
      if (filters.hasGeneratedText === false && pub.generated_text) {
        return false;
      }
      // Date range filter
      if (filters.dateRange.from && pub.post_date) {
        const pubDate = new Date(pub.post_date);
        if (pubDate < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to && pub.post_date) {
        const pubDate = new Date(pub.post_date);
        if (pubDate > filters.dateRange.to) return false;
      }
      return true;
    });
  }, [publications, filters]);

  // Apply sorting
  const sortedPublications = useMemo(() => {
    if (!sortColumn) return filteredPublications;
    
    return [...filteredPublications].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;
      
      switch (sortColumn) {
        case 'post_date':
          aVal = a.post_date ? new Date(a.post_date).getTime() : 0;
          bVal = b.post_date ? new Date(b.post_date).getTime() : 0;
          break;
        case 'views':
          aVal = a.views || 0;
          bVal = b.views || 0;
          break;
        case 'likes':
          aVal = a.likes || 0;
          bVal = b.likes || 0;
          break;
        case 'video_number':
          aVal = a.video?.video_number || 0;
          bVal = b.video?.video_number || 0;
          break;
      }
      
      if (aVal === bVal) return 0;
      const result = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? result : -result;
    });
  }, [filteredPublications, sortColumn, sortDirection]);

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts = { all: publications.length, pending: 0, checked: 0, published: 0, failed: 0 };
    publications.forEach(p => {
      if (p.publication_status === 'pending' || p.publication_status === 'needs_concat' || p.publication_status === 'concatenating') counts.pending++;
      else if (p.publication_status === 'checked' || p.publication_status === 'scheduled') counts.checked++;
      else if (p.publication_status === 'published') counts.published++;
      else if (p.publication_status === 'failed' || p.publication_status === 'error') counts.failed++;
    });
    return counts;
  }, [publications]);

  const tabFilteredPublications = useMemo(() => {
    if (!activeStatusTab) return sortedPublications;
    if (activeStatusTab === 'pending') return sortedPublications.filter(p => ['pending', 'needs_concat', 'concatenating'].includes(p.publication_status));
    if (activeStatusTab === 'checked') return sortedPublications.filter(p => ['checked', 'scheduled'].includes(p.publication_status));
    if (activeStatusTab === 'published') return sortedPublications.filter(p => p.publication_status === 'published');
    if (activeStatusTab === 'failed') return sortedPublications.filter(p => ['failed', 'error'].includes(p.publication_status));
    return sortedPublications;
  }, [sortedPublications, activeStatusTab]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить публикацию?')) {
      await deletePublication(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGenerateText = async (pub: Publication) => {
    setGeneratingIds(prev => new Set(prev).add(pub.id));
    try {
      await generateText(pub.id);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(pub.id);
        return next;
      });
    }
  };

  const handlePublish = async (pub: Publication) => {
    setPublishingIds(prev => new Set(prev).add(pub.id));
    try {
      console.log('Publishing:', pub.id);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setPublishingIds(prev => {
        const next = new Set(prev);
        next.delete(pub.id);
        return next;
      });
    }
  };

  const handleConcat = async (pub: Publication) => {
    const backCoverUrl = pub.channel?.back_cover_video_url || (pub.channel_id ? channelsById.get(pub.channel_id)?.back_cover_video_url : undefined);
    if (!backCoverUrl) {
      toast.error('У канала нет задней обложки');
      return;
    }
    
    // Try joined data first, then fetch from DB
    let mainVideoUrl = pub.video?.video_path || pub.video?.heygen_video_url;
    let frontCoverUrl: string | null = null;
    if (!mainVideoUrl && pub.video_id) {
      const { data: video } = await supabase
        .from('videos')
        .select('heygen_video_url, video_path, front_cover_url')
        .eq('id', pub.video_id)
        .single();
      mainVideoUrl = video?.video_path || video?.heygen_video_url || null;
      frontCoverUrl = video?.front_cover_url || null;
    } else if (pub.video_id) {
      // We have mainVideoUrl from joined data but need front_cover_url
      const { data: video } = await supabase
        .from('videos')
        .select('front_cover_url')
        .eq('id', pub.video_id)
        .single();
      frontCoverUrl = video?.front_cover_url || null;
    }
    
    if (!mainVideoUrl) {
      toast.error('Видео ещё не сгенерировано. Сначала создайте видео.');
      if (pub.publication_status === 'concatenating') {
        await updatePublication(pub.id, { publication_status: 'needs_concat' });
      }
      return;
    }
    
    setConcatingId(pub.id);
    try {
      await concatVideos(pub.id, mainVideoUrl, backCoverUrl, frontCoverUrl);
      await refetch();
    } catch {} finally {
      setConcatingId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tabFilteredPublications.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Удалить ${selectedIds.size} публикаций?`)) return;
    for (const id of selectedIds) {
      await deletePublication(id);
    }
    setSelectedIds(new Set());
  };

  const handleBulkUpdateStatus = async (status: string) => {
    for (const id of selectedIds) {
      await updatePublication(id, { publication_status: status });
    }
    setSelectedIds(new Set());
  };

  const handleBulkGenerateText = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const pub = publications.find(p => p.id === id);
      if (pub && !pub.generated_text) {
        await handleGenerateText(pub);
      }
    }
  };

  const handleBulkPublish = async () => {
    const ids = Array.from(selectedIds);
    const eligible = ids.filter(id => {
      const pub = publications.find(p => p.id === id);
      return pub && pub.publication_status !== 'published' && pub.publication_status !== 'pending' && hasReadyText(pub) && isConcatReady(pub);
    });
    if (eligible.length === 0) {
      toast.warning('Нет публикаций с готовым текстом для отправки');
      return;
    }
    for (const id of eligible) {
      const pub = publications.find(p => p.id === id)!;
      await handlePublish(pub);
    }
  };

  const handleBulkSetDate = async () => {
    if (!bulkDate) return;
    
    let dateWithTime = setHours(bulkDate, bulkHour);
    dateWithTime = setMinutes(dateWithTime, bulkMinute);
    const isoDate = dateWithTime.toISOString();
    
    for (const id of selectedIds) {
      await updatePublication(id, { post_date: isoDate });
    }
    setSelectedIds(new Set());
    setShowBulkDateDialog(false);
    setBulkDate(undefined);
  };

  const handleEditPublication = async (id: string, updates: Partial<Publication>) => {
    await updatePublication(id, updates);
  };

  const getStatusBadge = (status: string) => {
    const config = statusLabels[status] || statusLabels.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPublicationTitle = (pub: Publication) => {
    const question = pub.video?.question || 'Без вопроса';
    const advisor = pub.video?.advisor?.display_name || pub.video?.advisor?.name || 'Духовник';
    if (groupBy === 'question') return advisor;
    return `${question} — ${advisor}`;
  };

  const groupedPublications = tabFilteredPublications.reduce((acc, pub) => {
    let key: string;
    if (groupBy === 'channel') {
      // Group by social network type
      key = pub.channel?.network_type || 'Без сети';
    } else {
      key = pub.video?.question || 'Без вопроса';
    }
    
    if (!acc[key]) {
      acc[key] = {
        items: [],
        networkType: pub.channel?.network_type || '',
      };
    }
    acc[key].items.push(pub);
    return acc;
  }, {} as Record<string, { items: Publication[]; networkType: string }>);

  const resolveRow = (row: Record<string, any>, lookups: Lookups) => {
    const errors: string[] = [];
    
    let video_id: string | null = null;
    if (row.video_number) {
      const videoNum = parseInt(row.video_number);
      const video = lookups.videos?.find(v => v.video_number === videoNum);
      if (video) {
        video_id = video.id;
      } else {
        errors.push(`Ролик #${row.video_number} не найден`);
      }
    }
    
    let channel_id: string | null = null;
    if (row.channel_name) {
      const channel = lookups.channels?.find(c => 
        c.name.toLowerCase() === row.channel_name.toLowerCase()
      );
      if (channel) {
        channel_id = channel.id;
      } else {
        errors.push(`Канал "${row.channel_name}" не найден`);
      }
    }

    return {
      data: {
        ...row,
        video_id,
        channel_id,
      },
      errors,
    };
  };

  const handleImport = async (data: Record<string, any>[]) => {
    await bulkImport(data as Partial<Publication>[]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const allSelected = tabFilteredPublications.length > 0 && selectedIds.size === tabFilteredPublications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tabFilteredPublications.length;

  return (
    <div className="flex flex-col h-full">
      {/* Unified toolbar - matching Questions style */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          {/* Compact status tabs */}
          <div className="flex items-center gap-1">
            {[
              { key: null, label: 'Все', count: statusCounts.all, activeClass: 'bg-primary/10 text-primary border-primary' },
              { key: 'pending', label: 'Ожидают', count: statusCounts.pending, activeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500' },
              { key: 'checked', label: 'Проверены', count: statusCounts.checked, activeClass: 'bg-blue-500/10 text-blue-700 border-blue-500' },
              { key: 'published', label: 'Опубликовано', count: statusCounts.published, activeClass: 'bg-green-500/10 text-green-700 border-green-500' },
              { key: 'failed', label: 'Ошибки', count: statusCounts.failed, activeClass: 'bg-destructive/10 text-destructive border-destructive' },
            ].map(tab => (
              <button
                key={tab.key ?? 'all'}
                onClick={() => setActiveStatusTab(tab.key)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                  activeStatusTab === tab.key ? tab.activeClass : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.label} <span className="font-semibold">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          <PublicationFilters
            channels={channels}
            filters={filters}
            onFiltersChange={setFilters}
          />

          {/* Gear dropdown for bulk actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 relative">
                <Settings2 className="w-3.5 h-3.5" />
                {selectedIds.size > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {selectedIds.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {selectedIds.size > 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
                  Выбрано: {selectedIds.size} из {tabFilteredPublications.length}
                  <button className="ml-2 text-primary hover:underline" onClick={() => setSelectedIds(new Set())}>Сбросить</button>
                </div>
              )}
              {statusOptions.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  disabled={selectedIds.size === 0}
                  onClick={() => handleBulkUpdateStatus(s.value)}
                >
                  Статус → {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulkDateDialog(true)}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                Установить дату
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={handleBulkGenerateText}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Генерация текста
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={handleBulkPublish}
              >
                <Send className="w-3.5 h-3.5 mr-2" />
                Опубликовать
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                className="text-destructive focus:text-destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowImporter(true)}>
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
            Импорт
          </Button>
        </div>
      </div>

      {Object.keys(groupedPublications).length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет публикаций</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedPublications).map(([groupName, { items: pubs, networkType }]) => (
          <Card key={groupName} className="glass-card">
            <CardContent className="p-0">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="font-semibold text-sm capitalize">{groupName}</h3>
                <p className="text-xs text-muted-foreground">{pubs.length} публикаций</p>
              </div>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-[40px] py-1">
                      {(() => {
                        const groupIds = pubs.map(p => p.id);
                        const groupSelectedCount = groupIds.filter(id => selectedIds.has(id)).length;
                        const groupAllSelected = groupIds.length > 0 && groupSelectedCount === groupIds.length;
                        const groupSomeSelected = groupSelectedCount > 0 && groupSelectedCount < groupIds.length;
                        return (
                          <Checkbox
                            checked={groupAllSelected}
                            ref={(el) => {
                              if (el) (el as any).indeterminate = groupSomeSelected;
                            }}
                            onCheckedChange={(checked) => {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (checked) {
                                  groupIds.forEach(id => next.add(id));
                                } else {
                                  groupIds.forEach(id => next.delete(id));
                                }
                                return next;
                              });
                            }}
                          />
                        );
                      })()}
                    </TableHead>
                    <TableHead className="py-1">Заголовок</TableHead>
                    <TableHead 
                      className="w-[60px] py-1 cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort('video_number')}
                    >
                      <div className="flex items-center">
                        ID {getSortIcon('video_number')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[120px] py-1 whitespace-nowrap">Учетная запись</TableHead>
                    <TableHead 
                      className="w-[110px] py-1 cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort('post_date')}
                    >
                      <div className="flex items-center">
                        Дата {getSortIcon('post_date')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px] py-1">Длина</TableHead>
                    <TableHead className="w-[80px] py-1">Размер</TableHead>
                    <TableHead className="w-[100px] py-1">Ссылка</TableHead>
                    <TableHead className="w-[50px] py-1">Склейка</TableHead>
                    <TableHead className="w-[50px] py-1">Текст</TableHead>
                    <TableHead className="w-[70px] py-1">Проверка</TableHead>
                    <TableHead className="w-[90px] py-1">Публикация</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pubs.map((pub) => {
                    const concatRequired = requiresConcat(pub);
                    const isConcating = concatingId === pub.id;
                    const hasFinalVideo = !!pub.final_video_url;
                    const isBusyConcat = isConcating || (pub.publication_status === 'concatenating' && !isStaleConcatenating(pub));
                    const isChecked = pub.publication_status === 'checked' || pub.publication_status === 'scheduled' || pub.publication_status === 'published';
                    const videoSrc = pub.final_video_url || pub.video?.video_path || pub.video?.heygen_video_url;

                    return (
                    <TableRow 
                      key={pub.id}
                      className={cn(
                        selectedIds.has(pub.id) && 'bg-primary/5',
                        'cursor-pointer hover:bg-muted/50 h-10'
                      )}
onClick={() => setEditingPublicationId(pub.id)}
                    >
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(pub.id)}
                          onCheckedChange={(checked) => handleSelectOne(pub.id, !!checked)}
                        />
                      </TableCell>
                      {/* Заголовок */}
                      <TableCell className="py-1">
                        <span className="truncate block" title={getPublicationTitle(pub)}>
                          {getPublicationTitle(pub)}
                        </span>
                      </TableCell>
                      {/* ID */}
                      <TableCell className="py-1 font-mono text-muted-foreground">
                        {pub.video?.video_number || '—'}
                      </TableCell>
                      {/* Учетная запись */}
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">{pub.channel?.name || '—'}</Badge>
                      </TableCell>
                      {/* Дата */}
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEdit
                          type="datetime"
                          value={pub.post_date}
                          onSave={async (value) => {
                            await updatePublication(pub.id, { post_date: value });
                          }}
                          placeholder="—"
                          displayClassName="text-xs"
                        />
                      </TableCell>
                      {/* Длина */}
                      <TableCell className="py-1">
                        <PublicationDurationCell
                          duration={pub.video?.video_duration}
                          videoUrl={videoSrc}
                          audioUrl={pub.video?.voiceover_url}
                          videoId={pub.video?.id}
                        />
                      </TableCell>
                      {/* Размер */}
                      <TableCell className="py-1">
                        <PublicationSizeCell videoUrl={videoSrc} />
                      </TableCell>
                      {/* Ссылка на публикации */}
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        {pub.post_url ? (
                          <a href={pub.post_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-[100px]" title={pub.post_url}>
                            {(() => { try { return new URL(pub.post_url).hostname; } catch { return pub.post_url; } })()}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Склейка — concat action + result */}
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {concatRequired && hasFinalVideo && !isBusyConcat && (
                            <>
                              <button className="p-0.5 hover:bg-muted rounded" title="Превью склейки" onClick={() => setPreviewVideoUrl(pub.final_video_url!)}>
                                <Clapperboard className="w-3.5 h-3.5 text-green-600 hover:text-foreground" />
                              </button>
                              <button className="p-0.5 hover:bg-muted rounded" title="Пересклеить видео" onClick={() => handleConcat(pub)}>
                                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                              </button>
                            </>
                          )}
                          {concatRequired && !hasFinalVideo && !isBusyConcat && (
                            <button className="p-0.5 hover:bg-muted rounded" title="Склеить видео" onClick={() => handleConcat(pub)}>
                              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                          )}
                          {isBusyConcat && (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                              <button
                                className="p-0.5 hover:bg-muted rounded"
                                title="Остановить склейку"
                                onClick={async () => {
                                  await cancelConcat(pub.id);
                                  setConcatingId(null);
                                  await refetch();
                                }}
                              >
                                <Square className="w-3 h-3 text-destructive hover:text-foreground" />
                              </button>
                            </>
                          )}
                          {!concatRequired && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                      {/* Текст status — text preview icon */}
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        {hasReadyText(pub) ? (
                          <button className="p-0.5 hover:bg-muted rounded" title="Превью текста" onClick={() => setPreviewText(pub.generated_text!)}>
                            <FileText className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-muted-foreground/30" />
                        )}
                      </TableCell>
                      {/* Проверка */}
                      <TableCell className="py-1">
                        {isChecked ? (
                          <span className="font-medium text-green-600">Проверено</span>
                        ) : (
                          <span className="text-muted-foreground">Не проверен</span>
                        )}
                      </TableCell>
                      {/* Статус */}
                      <TableCell className="py-1">
                        {getStatusBadge(pub.publication_status)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт публикаций из CSV"
        columnMapping={PUBLICATION_COLUMN_MAPPING}
        previewColumns={PUBLICATION_PREVIEW_COLUMNS}
        onImport={handleImport}
        lookups={{ channels, videos }}
        resolveRow={resolveRow}
        fieldDefinitions={PUBLICATION_FIELD_DEFINITIONS}
      />

      {/* Edit Dialog */}
      <PublicationEditDialog
        publication={editingPublication}
        open={!!editingPublicationId}
        onClose={() => setEditingPublicationId(null)}
        onSave={handleEditPublication}
        onPrev={editingPublication ? (() => {
          const idx = tabFilteredPublications.findIndex(p => p.id === editingPublicationId);
          if (idx > 0) setEditingPublicationId(tabFilteredPublications[idx - 1].id);
        }) : undefined}
        onNext={editingPublication ? (() => {
          const idx = tabFilteredPublications.findIndex(p => p.id === editingPublicationId);
          if (idx < tabFilteredPublications.length - 1) setEditingPublicationId(tabFilteredPublications[idx + 1].id);
        }) : undefined}
      />

      {/* Bulk Date Dialog */}
      <AlertDialog open={showBulkDateDialog} onOpenChange={setShowBulkDateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Установить дату для {selectedIds.size} публикаций
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <Calendar
              mode="single"
              selected={bulkDate}
              onSelect={setBulkDate}
              locale={ru}
              className="rounded-md border mx-auto"
            />
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={bulkHour.toString()} onValueChange={(v) => setBulkHour(parseInt(v))}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {hours.map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h.toString().padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>:</span>
              <Select value={bulkMinute.toString()} onValueChange={(v) => setBulkMinute(parseInt(v))}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {minuteOptions.map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m.toString().padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button onClick={handleBulkSetDate} disabled={!bulkDate}>
              Применить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideoUrl} onOpenChange={(o) => !o && setPreviewVideoUrl(null)}>
        <DialogContent className="max-w-fit p-0">
          <DialogHeader className="p-3 pb-0">
            <DialogTitle className="text-sm">Превью видео</DialogTitle>
          </DialogHeader>
          {previewVideoUrl && (
            <div className="p-3 pt-2 flex justify-center">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="max-h-[70vh] rounded-md"
                crossOrigin="anonymous"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Text Preview Dialog */}
      <Dialog open={!!previewText} onOpenChange={(o) => !o && setPreviewText(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Превью текста</DialogTitle>
          </DialogHeader>
          {previewText && (
            <div className="max-h-[400px] overflow-auto whitespace-pre-wrap text-sm">
              {previewText}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
