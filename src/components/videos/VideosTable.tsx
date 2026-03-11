import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VideoFilters, VideoFilterState } from './VideoFilters';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import { Publication } from '@/hooks/usePublications';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Upload,
  Settings2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface VideosTableProps {
  videos: Video[];
  advisors: Advisor[];
  playlists: Playlist[];
  publications: Publication[];
  publishingChannels: PublishingChannel[];
  loading: boolean;
  onEditVideo: (video: Video) => void;
  onDeleteVideo: (id: string) => void;
  onGenerateVideo: (video: Video) => void;
  onGenerateCover: (video: Video) => void;
  onGenerateAtmosphere?: (video: Video) => void;
  onGenerateVoiceover?: (video: Video) => void;
  onAddVideo: () => void;
  onImportVideos: () => void;
  onViewVideo: (video: Video) => void;
  onUpdateVideo?: (id: string, updates: Partial<Video>) => Promise<void>;
  onBulkDelete?: (videoIds: string[]) => Promise<void>;
  onBulkGenerateCovers?: (videoIds: string[]) => Promise<void>;
  onBulkGenerateVideos?: (videoIds: string[]) => Promise<void>;
  onBulkUpdateStatus?: (videoIds: string[], status: string) => Promise<void>;
  onBulkPublish?: (videoIds: string[]) => Promise<void>;
  filters: {
    advisorId?: string;
    playlistId?: string;
    status?: string;
    search?: string;
    questionId?: number;
  };
  onFilterChange: (filters: any) => void;
}

// Unified 4-state status config
const statusConfig: Record<string, string> = {
  pending: 'bg-muted-foreground/30',
  generating: 'bg-yellow-500',
  ready: 'bg-green-500',
  error: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  generating: 'In progress',
  ready: 'Ready',
  error: 'Error',
};

// Resolve effective status: if asset URL exists → ready
function resolveStatus(dbStatus: string | null, assetUrl: string | null | undefined): string {
  if (assetUrl) return 'ready';
  const s = dbStatus || 'pending';
  if (s === 'atmosphere_ready' || s === 'published') return 'ready';
  if (statusConfig[s]) return s;
  return 'pending';
}

type SortColumn = 'id' | 'advisor' | 'cover_status' | 'video_status' | 'duration' | null;
type SortDirection = 'asc' | 'desc';

export function VideosTable({
  videos,
  advisors,
  playlists,
  publications,
  publishingChannels,
  loading,
  onEditVideo,
  onDeleteVideo,
  onGenerateVideo,
  onGenerateCover,
  onGenerateAtmosphere,
  onGenerateVoiceover,
  onAddVideo,
  onImportVideos,
  onViewVideo,
  onUpdateVideo,
  onBulkDelete,
  onBulkGenerateCovers,
  onBulkGenerateVideos,
  onBulkUpdateStatus,
  onBulkPublish,
  filters,
  onFilterChange,
}: VideosTableProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('advisor');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'in_progress' | 'published' | 'all'>('in_progress');
  const [advancedFilters, setAdvancedFilters] = useState<VideoFilterState>({
    coverStatusFilter: [],
    videoStatusFilter: [],
    hasCover: null,
    hasVideo: null,
    dateRange: { from: null, to: null },
  });
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = (videoId: string, url: string) => {
    if (playingAudioId === videoId) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingAudioId(null);
    } else {
      audioRef.current?.pause();
      const audio = new Audio(url);
      audio.onended = () => { setPlayingAudioId(null); audioRef.current = null; };
      audio.play();
      audioRef.current = audio;
      setPlayingAudioId(videoId);
    }
  };

  const toggleQuestion = (question: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(question)) {
      newExpanded.delete(question);
    } else {
      newExpanded.add(question);
    }
    setExpandedQuestions(newExpanded);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3" /> 
      : <ArrowDown className="w-3 h-3" />;
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    const uniqueQuestionsForStatus = (status: string) => {
      const qids = new Set(videos.filter(v => v.question_status === status).map(v => v.question_id));
      return qids.size;
    };
    const inProgressVideos = videos.filter(v => v.question_status === 'in_progress');
    const publishedVideos = videos.filter(v => v.question_status === 'published' || v.question_status === 'not_selected');
    return {
      in_progress: { questions: uniqueQuestionsForStatus('in_progress'), videos: inProgressVideos.length },
      published: { questions: uniqueQuestionsForStatus('published') + uniqueQuestionsForStatus('not_selected'), videos: publishedVideos.length },
      all: { questions: new Set(videos.map(v => v.question_id)).size, videos: videos.length },
    };
  }, [videos]);

  // Filter by tab + advanced filters
  const filteredVideos = useMemo(() => {
    let result = videos;

    if (activeTab === 'in_progress') {
      result = result.filter(v => v.question_status === 'in_progress');
    } else if (activeTab === 'published') {
      result = result.filter(v => v.question_status === 'published' || v.question_status === 'not_selected');
    }

    if (filters.questionId !== undefined) {
      result = result.filter(v => v.question_id === filters.questionId);
    }

    if (advancedFilters.coverStatusFilter.length > 0) {
      result = result.filter(v => advancedFilters.coverStatusFilter.includes(v.cover_status || 'pending'));
    }

    if (advancedFilters.videoStatusFilter.length > 0) {
      result = result.filter(v => advancedFilters.videoStatusFilter.includes(v.generation_status || 'pending'));
    }

    if (advancedFilters.hasCover === true) {
      result = result.filter(v => v.front_cover_url || v.cover_url);
    } else if (advancedFilters.hasCover === false) {
      result = result.filter(v => !v.front_cover_url && !v.cover_url);
    }

    if (advancedFilters.hasVideo === true) {
      result = result.filter(v => v.heygen_video_url || v.video_path);
    } else if (advancedFilters.hasVideo === false) {
      result = result.filter(v => !v.heygen_video_url && !v.video_path);
    }

    if (advancedFilters.dateRange.from) {
      result = result.filter(v => new Date(v.created_at) >= advancedFilters.dateRange.from!);
    }
    if (advancedFilters.dateRange.to) {
      result = result.filter(v => new Date(v.created_at) <= advancedFilters.dateRange.to!);
    }

    return result;
  }, [videos, activeTab, filters.questionId, advancedFilters]);

  // Sort videos
  const sortedVideos = useMemo(() => {
    if (!sortColumn) return filteredVideos;
    
    return [...filteredVideos].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'id':
          comparison = (a.video_number || 0) - (b.video_number || 0);
          break;
        case 'advisor':
          const nameA = a.advisor?.display_name || a.advisor?.name || '';
          const nameB = b.advisor?.display_name || b.advisor?.name || '';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'cover_status':
          comparison = (a.cover_status || '').localeCompare(b.cover_status || '');
          break;
        case 'video_status':
          comparison = (a.generation_status || '').localeCompare(b.generation_status || '');
          break;
        case 'duration':
          comparison = (a.video_duration || 0) - (b.video_duration || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredVideos, sortColumn, sortDirection]);

  // Group videos by question_id
  const groupedVideos = useMemo(() => {
    return sortedVideos.reduce((acc, video) => {
      const uniqueKey = `${video.question_id ?? 'none'}`;
      if (!acc[uniqueKey]) {
        const questionText = video.question_rus || video.question_eng || video.question || 'Без вопроса';
        acc[uniqueKey] = { questionId: video.question_id, questionText, videos: [], plannedDate: video.publication_date };
      } else {
        const group = acc[uniqueKey];
        if (video.question_rus && (!group.questionText || group.questionText === (video.question_eng || video.question))) {
          group.questionText = video.question_rus;
        }
      }
      acc[uniqueKey].videos.push(video);
      if (video.publication_date && (!acc[uniqueKey].plannedDate || video.publication_date < acc[uniqueKey].plannedDate!)) {
        acc[uniqueKey].plannedDate = video.publication_date;
      }
      return acc;
    }, {} as Record<string, { questionId: number | null; questionText: string; videos: Video[]; plannedDate: string | null }>);
  }, [sortedVideos]);

  // Selection handlers
  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideoIds);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideoIds(newSelected);
  };

  const toggleAllInQuestion = (questionVideos: Video[]) => {
    const allSelected = questionVideos.every(v => selectedVideoIds.has(v.id));
    const newSelected = new Set(selectedVideoIds);
    
    if (allSelected) {
      questionVideos.forEach(v => newSelected.delete(v.id));
    } else {
      questionVideos.forEach(v => newSelected.add(v.id));
    }
    
    setSelectedVideoIds(newSelected);
  };

  const clearSelection = () => setSelectedVideoIds(new Set());

  const getVideoPublications = (videoId: string) => {
    return publications.filter(p => p.video_id === videoId);
  };

  const isExpanded = (question: string) => expandedQuestions.has('__all__') || expandedQuestions.has(question);

  // Bulk actions
  const handleBulkDelete = async () => {
    if (onBulkDelete && selectedVideoIds.size > 0) {
      await onBulkDelete(Array.from(selectedVideoIds));
      clearSelection();
    }
  };

  const handleBulkGenerateCovers = async () => {
    if (onBulkGenerateCovers && selectedVideoIds.size > 0) {
      await onBulkGenerateCovers(Array.from(selectedVideoIds));
    }
  };

  const handleBulkGenerateVideos = async () => {
    if (onBulkGenerateVideos && selectedVideoIds.size > 0) {
      await onBulkGenerateVideos(Array.from(selectedVideoIds));
    }
  };

  const formatPlannedDate = (date: string | null) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd.MM.yyyy', { locale: ru });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const COL_GRID = 'grid-cols-[40px_130px_80px_80px_80px_55px_40px_70px_70px_70px_40px]';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {[
              { key: 'in_progress' as const, label: 'В работе', count: `${tabCounts.in_progress.questions}/${tabCounts.in_progress.videos}`, activeClass: 'bg-primary/10 text-primary border-primary' },
              { key: 'published' as const, label: 'Отработанные', count: `${tabCounts.published.questions}/${tabCounts.published.videos}`, activeClass: 'bg-muted text-foreground border-muted-foreground/40' },
              { key: 'all' as const, label: 'Все', count: `${tabCounts.all.questions}/${tabCounts.all.videos}`, activeClass: 'bg-primary/10 text-primary border-primary' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.key ? tab.activeClass : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.label} <span className="font-semibold">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          <VideoFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} />

          {filters.questionId !== undefined && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 text-xs"
              onClick={() => onFilterChange({ ...filters, questionId: undefined })}
            >
              ✕ Фильтр вопроса
            </Button>
          )}

          {/* Gear dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 relative">
                <Settings2 className="w-3.5 h-3.5" />
                {selectedVideoIds.size > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {selectedVideoIds.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onImportVideos}>
                <Upload className="w-3.5 h-3.5 mr-2" />
                Импорт
              </DropdownMenuItem>
              {selectedVideoIds.size > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1 pt-1.5">
                    Выбрано: {selectedVideoIds.size}
                    <button className="ml-2 text-primary hover:underline" onClick={clearSelection}>Сбросить</button>
                  </div>
                  <DropdownMenuItem onClick={handleBulkGenerateCovers}>
                    <ImageIcon className="w-3.5 h-3.5 mr-2" />
                    Генерация обложек
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkGenerateVideos}>
                    <VideoIcon className="w-3.5 h-3.5 mr-2" />
                    Генерация видео
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const selected = videos.filter(v => selectedVideoIds.has(v.id));
                      const withoutDate = selected.filter(v => !v.publication_date);
                      if (withoutDate.length > 0) {
                        toast.error(`${withoutDate.length} ролик(ов) без плановой даты`);
                        return;
                      }
                      onBulkPublish?.(Array.from(selectedVideoIds));
                    }}
                  >
                    <Send className="w-3.5 h-3.5 mr-2" />
                    На публикацию
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Удалить
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grouped Table */}
      <div className="flex-1 overflow-auto">
      {Object.keys(groupedVideos).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Play className="w-12 h-12 mb-4" />
          <p>Нет роликов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedVideos).map(([uniqueKey, { questionId, questionText, videos: questionVideos, plannedDate }]) => (
            <div key={uniqueKey} className="border-b border-border/50">
              <Collapsible
                open={isExpanded(uniqueKey)}
                onOpenChange={() => toggleQuestion(uniqueKey)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 py-2 cursor-pointer hover:bg-muted/30 transition-colors px-2">
                    <Checkbox
                      checked={questionVideos.every(v => selectedVideoIds.has(v.id))}
                      onCheckedChange={() => toggleAllInQuestion(questionVideos)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    {isExpanded(uniqueKey) ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground text-xs font-mono">#{questionId}</span>
                    <span className="font-medium text-sm">{questionText}</span>
                    {plannedDate && (
                      <span className="text-muted-foreground text-xs ml-1">{formatPlannedDate(plannedDate)}</span>
                    )}
                    <span className="text-muted-foreground text-sm ml-2">{questionVideos.length}</span>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* Table Header */}
                  <div className={`grid ${COL_GRID} gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-y border-border/30`}>
                    <div></div>
                    <button onClick={() => handleSort('advisor')} className="flex items-center gap-1 hover:text-foreground">
                      Духовник {getSortIcon('advisor')}
                    </button>
                    <button onClick={() => handleSort('cover_status')} className="flex items-center gap-1 hover:text-foreground">
                      Cover {getSortIcon('cover_status')}
                    </button>
                    <div>Озвучка</div>
                    <button onClick={() => handleSort('video_status')} className="flex items-center gap-1 hover:text-foreground">
                      Video {getSortIcon('video_status')}
                    </button>
                    <button onClick={() => handleSort('duration')} className="flex items-center gap-1 hover:text-foreground">
                      Длина {getSortIcon('duration')}
                    </button>
                    <div>🎬</div>
                    <div>Обложка</div>
                    <div>Звук</div>
                    <div>Видео</div>
                    <div></div>
                  </div>

                  {/* Table Rows */}
                  {questionVideos.map((video) => {
                    const coverUrl = video.front_cover_url || video.cover_url;
                    const effectiveCoverStatus = resolveStatus(video.cover_status, coverUrl);
                    const effectiveVoiceoverStatus = resolveStatus(video.voiceover_status, video.voiceover_url);
                    const effectiveVideoStatus = resolveStatus(video.generation_status, video.video_path || video.heygen_video_url);
                    
                    return (
                      <div
                        key={video.id}
                        className={`grid ${COL_GRID} gap-2 px-4 py-2 text-sm hover:bg-muted/30 border-b border-border/20 items-center cursor-pointer`}
                        onClick={() => onViewVideo(video)}
                      >
                        {/* Checkbox */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedVideoIds.has(video.id)}
                            onCheckedChange={() => toggleVideoSelection(video.id)}
                          />
                        </div>

                        {/* Духовник */}

                        {/* Духовник */}
                        <div>
                          <Badge variant="outline" className="text-xs font-normal">
                            {video.advisor?.display_name || video.advisor?.name || '—'}
                          </Badge>
                        </div>

                        {/* Cover status */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${statusConfig[effectiveCoverStatus] || statusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[effectiveCoverStatus]}</span>
                        </div>

                        {/* Voiceover status */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${statusConfig[effectiveVoiceoverStatus] || statusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[effectiveVoiceoverStatus]}</span>
                        </div>

                        {/* Video status */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${statusConfig[effectiveVideoStatus] || statusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[effectiveVideoStatus]}</span>
                        </div>

                        {/* Duration */}
                        <div className="text-xs text-muted-foreground">
                          {video.video_duration ? `${video.video_duration}s` : '—'}
                        </div>


                        {/* Video preview */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {(video.video_path || video.heygen_video_url) ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button size="icon-xs" variant="ghost" title="Смотреть видео">
                                  <VideoIcon className="w-3 h-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-2" side="top">
                                <video
                                  src={video.video_path || video.heygen_video_url!}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="w-full rounded-md"
                                  poster={video.front_cover_url || undefined}
                                />
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </div>

                        {/* Обложка button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {effectiveCoverStatus === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="generate-cover"
                              onClick={() => onGenerateCover(video)}
                            >
                              Обложка
                            </Button>
                          )}
                        </div>

                        {/* Звук button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {effectiveVoiceoverStatus === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onGenerateVoiceover?.(video)}
                              disabled={!video.advisor_answer}
                              title={!video.advisor_answer ? 'Сначала нужен ответ духовника' : undefined}
                            >
                              Звук
                            </Button>
                          )}
                        </div>

                        {/* Видео button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {effectiveVideoStatus === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="generate-video"
                              onClick={() => onGenerateVideo(video)}
                              disabled={!video.voiceover_url}
                              title={!video.voiceover_url ? 'Сначала создайте озвучку' : undefined}
                            >
                              Видео
                            </Button>
                          )}
                        </div>

                        {/* Channels */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const selectedCount = publishingChannels.filter(c => c.is_active && video.selected_channels?.includes(c.id)).length;
                            const selectedNames = publishingChannels
                              .filter(c => video.selected_channels?.includes(c.id))
                              .map(c => c.name);
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button size="xs" variant="ghost" className="h-6 px-1 gap-1" title="Каналы публикации">
                                        <Send className="w-3 h-3" />
                                        {selectedCount > 0 && (
                                          <span className="text-xs font-medium">{selectedCount}</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2" side="left">
                                      <div className="flex flex-wrap gap-1">
                                        {publishingChannels.filter(c => c.is_active).map((channel) => {
                                          const isSelected = video.selected_channels?.includes(channel.id) || false;
                                          return (
                                            <Badge
                                              key={channel.id}
                                              variant={isSelected ? "default" : "outline"}
                                              className={`text-[10px] font-normal cursor-pointer transition-colors ${
                                                isSelected 
                                                  ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                                                  : 'hover:bg-muted'
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const currentChannels = video.selected_channels || [];
                                                const newChannels = isSelected
                                                  ? currentChannels.filter(id => id !== channel.id)
                                                  : [...currentChannels, channel.id];
                                                onUpdateVideo?.(video.id, { selected_channels: newChannels });
                                              }}
                                            >
                                              {channel.name}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TooltipTrigger>
                                {selectedCount > 0 && (
                                  <TooltipContent side="left">
                                    <div className="text-xs space-y-0.5">
                                      {selectedNames.map(name => (
                                        <div key={name}>{name}</div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      )}

      {/* Record count */}
      <div className="text-sm text-muted-foreground px-4 py-2">
        {filteredVideos.length} из {videos.length} записей
      </div>
      </div>
    </div>
  );
}
