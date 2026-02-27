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
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { VideoFilters, VideoFilterState } from './VideoFilters';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import { Publication } from '@/hooks/usePublications';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
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
  Download,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

const coverStatusConfig: Record<string, string> = {
  pending: 'bg-muted-foreground/30',
  generating: 'bg-yellow-500',
  atmosphere_ready: 'bg-amber-500',
  ready: 'bg-green-500',
  error: 'bg-red-500',
};

const videoStatusConfig: Record<string, string> = {
  pending: 'bg-muted-foreground/30',
  generating: 'bg-yellow-500',
  ready: 'bg-green-500',
  published: 'bg-blue-500',
  error: 'bg-red-500',
};

const voiceoverStatusConfig: Record<string, string> = {
  pending: 'bg-muted-foreground/30',
  generating: 'bg-yellow-500',
  ready: 'bg-green-500',
  error: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  generating: 'In progress',
  atmosphere_ready: 'Фон готов',
  ready: 'Ready',
  published: 'Published',
  error: 'Error',
};

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

  // Filter: only show videos with question_status === 'in_progress'
  const filteredVideos = useMemo(() => {
    let result = videos.filter(v => v.question_status === 'in_progress');

    // Question filter
    if (filters.questionId !== undefined) {
      result = result.filter(v => v.question_id === filters.questionId);
    }

    // Cover status filter
    if (advancedFilters.coverStatusFilter.length > 0) {
      result = result.filter(v => advancedFilters.coverStatusFilter.includes(v.cover_status || 'pending'));
    }

    // Video status filter
    if (advancedFilters.videoStatusFilter.length > 0) {
      result = result.filter(v => advancedFilters.videoStatusFilter.includes(v.generation_status || 'pending'));
    }

    // Has cover
    if (advancedFilters.hasCover === true) {
      result = result.filter(v => v.front_cover_url || v.cover_url);
    } else if (advancedFilters.hasCover === false) {
      result = result.filter(v => !v.front_cover_url && !v.cover_url);
    }

    // Has video
    if (advancedFilters.hasVideo === true) {
      result = result.filter(v => v.heygen_video_url || v.video_path);
    } else if (advancedFilters.hasVideo === false) {
      result = result.filter(v => !v.heygen_video_url && !v.video_path);
    }

    // Date range
    if (advancedFilters.dateRange.from) {
      result = result.filter(v => new Date(v.created_at) >= advancedFilters.dateRange.from!);
    }
    if (advancedFilters.dateRange.to) {
      result = result.filter(v => new Date(v.created_at) <= advancedFilters.dateRange.to!);
    }

    return result;
  }, [videos, filters.questionId, advancedFilters]);

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

  // Group videos by composite key (question_id + question text)
  const groupedVideos = useMemo(() => {
    return sortedVideos.reduce((acc, video) => {
      const questionText = video.question_rus || video.question_eng || video.question || 'Без вопроса';
      const uniqueKey = `${video.question_id}_${questionText}`;
      if (!acc[uniqueKey]) {
        acc[uniqueKey] = { questionId: video.question_id, questionText, videos: [], plannedDate: video.publication_date };
      }
      acc[uniqueKey].videos.push(video);
      // Use earliest date
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

  // Get publications for a video
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

  const handleExportXlsx = () => {
    const safetyMap: Record<string, string> = {
      safe: '✅ Безопасно',
      caution: '⚠️ Осторожно',
      unsafe: '🚫 Небезопасно',
    };

    const rows = filteredVideos.map((video) => {
      const advisorName = video.advisor?.display_name || video.advisor?.name || '';
      const playlistName = video.playlist?.name || '';
      return {
        'ID ролика': video.video_number ?? '',
        'ID вопроса': video.question_id ?? '',
        'Духовник': advisorName,
        'Безопасность вопроса': safetyMap[video.safety_score || ''] || video.safety_score || '',
        'Актуальность': video.relevance_score ?? '',
        'Хук': video.hook || '',
        'Вопрос': video.question || '',
        'Плейлист': playlistName,
        'Ответ духовника': video.advisor_answer || '',
        'Сцены для плейлистов': playlistName && advisorName ? `${playlistName} - ${advisorName}` : '',
        'Заголовок видео': video.video_title || '',
        'Промт для ответа': video.answer_prompt || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ролики');
    XLSX.writeFile(wb, `Ролики_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedVideoIds.size}
        totalCount={videos.length}
        onClearSelection={clearSelection}
      >
        <BulkActionButton
          variant="destructive"
          icon={<Trash2 className="w-3 h-3 mr-1" />}
          onClick={handleBulkDelete}
        >
          Удалить
        </BulkActionButton>
        <BulkActionButton
          variant="generate-cover"
          icon={<ImageIcon className="w-3 h-3 mr-1" />}
          onClick={handleBulkGenerateCovers}
        >
          Генерация обложек
        </BulkActionButton>
        <BulkActionButton
          variant="generate-video"
          icon={<VideoIcon className="w-3 h-3 mr-1" />}
          onClick={handleBulkGenerateVideos}
        >
          Генерация видео
        </BulkActionButton>
        <BulkActionButton
          variant="default"
          icon={<Send className="w-3 h-3 mr-1" />}
          onClick={() => onBulkPublish?.(Array.from(selectedVideoIds))}
        >
          На публикацию
        </BulkActionButton>
      </BulkActionsBar>

      {/* Filters - only VideoFilters and question filter reset */}
      <div className="flex flex-wrap gap-4 items-center">
        <VideoFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} />

        {filters.questionId !== undefined && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onFilterChange({ ...filters, questionId: undefined })}
          >
            ✕ Сбросить фильтр вопроса
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onImportVideos}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Импорт
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXlsx}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Выгрузка
          </Button>
        </div>
      </div>

      {/* Grouped Table */}
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
                {/* Question Header - new format: #ID, Question, Date */}
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
                  <div className="grid grid-cols-[40px_60px_150px_100px_100px_100px_70px_80px_80px_100px_80px_120px_40px] gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-y border-border/30">
                    <div></div>
                    <button
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      ID {getSortIcon('id')}
                    </button>
                    <button
                      onClick={() => handleSort('advisor')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Духовник {getSortIcon('advisor')}
                    </button>
                    <button
                      onClick={() => handleSort('cover_status')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Cover {getSortIcon('cover_status')}
                    </button>
                    <div>Озвучка</div>
                    <button
                      onClick={() => handleSort('video_status')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Video {getSortIcon('video_status')}
                    </button>
                    <button
                      onClick={() => handleSort('duration')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Длина {getSortIcon('duration')}
                    </button>
                    <div>Превью</div>
                    <div>Фон</div>
                    <div>Обложка</div>
                    <div>Озвучка</div>
                    <div>Video</div>
                    <div></div>
                  </div>

                  {/* Table Rows */}
                  {questionVideos.map((video) => {
                    const videoPubs = getVideoPublications(video.id);
                    const coverUrl = video.front_cover_url || video.cover_url;
                    const effectiveCoverStatus = video.cover_status === 'generating' && coverUrl ? 'ready' : (video.cover_status || 'pending');
                    const isCoverGenerating = effectiveCoverStatus === 'generating';
                    
                    return (
                      <div
                        key={video.id}
                        className="grid grid-cols-[40px_60px_150px_100px_100px_100px_70px_80px_80px_100px_80px_120px_40px] gap-2 px-4 py-2 text-sm hover:bg-muted/30 border-b border-border/20 items-center"
                      >
                        {/* Checkbox */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedVideoIds.has(video.id)}
                            onCheckedChange={() => toggleVideoSelection(video.id)}
                          />
                        </div>

                        {/* ID - clickable to open side panel */}
                        <div 
                          className="font-mono text-xs text-primary cursor-pointer hover:underline"
                          onClick={() => onViewVideo(video)}
                        >
                          {video.video_number || '—'}
                        </div>

                        {/* Духовник */}
                        <div>
                          <Badge variant="outline" className="text-xs font-normal">
                            {video.advisor?.display_name || video.advisor?.name || '—'}
                          </Badge>
                        </div>

                        {/* Cover status - text only */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${coverStatusConfig[effectiveCoverStatus] || coverStatusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[effectiveCoverStatus] || 'Pending'}</span>
                        </div>

                        {/* Voiceover status */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${voiceoverStatusConfig[video.voiceover_status || 'pending'] || voiceoverStatusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[video.voiceover_status || 'pending'] || 'Pending'}</span>
                        </div>

                        {/* Video status - text only */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${videoStatusConfig[video.generation_status || 'pending'] || videoStatusConfig.pending}`} />
                          <span className="text-xs text-muted-foreground">{statusLabels[video.generation_status || 'pending'] || 'Pending'}</span>
                        </div>

                        {/* Duration - text only */}
                        <div className="text-xs text-muted-foreground">
                          {video.video_duration ? `${video.video_duration}s` : '—'}
                        </div>

                        {/* Cover preview (final cover) */}
                        <div>
                          {coverUrl ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <div className="w-12 h-8 rounded overflow-hidden cursor-pointer border border-border">
                                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 p-2">
                                <img src={coverUrl} alt="Cover preview" className="w-full rounded" />
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Atmosphere (Step 1) button */}
                        <div>
                          {isCoverGenerating ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (video as any).atmosphere_url ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <div className="w-12 h-8 rounded overflow-hidden cursor-pointer border border-border" onClick={() => onGenerateAtmosphere?.(video)}>
                                  <img src={(video as any).atmosphere_url} alt="Фон" className="w-full h-full object-cover" />
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 p-2">
                                <img src={(video as any).atmosphere_url} alt="Atmosphere preview" className="w-full rounded" />
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-amber-700 border-amber-500/50"
                              onClick={() => onGenerateAtmosphere?.(video)}
                            >
                              Фон
                            </Button>
                          )}
                        </div>

                        {/* Cover (Step 2) button */}
                        <div>
                          {isCoverGenerating ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="generate-cover"
                              onClick={() => onGenerateCover(video)}
                              disabled={!(video as any).atmosphere_url}
                            >
                              Обложка
                            </Button>
                          )}
                        </div>

                        {/* Voiceover button */}
                        <div>
                          {video.voiceover_status === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : video.voiceover_url ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => toggleAudio(video.id, video.voiceover_url!)}
                            >
                              {playingAudioId === video.id ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onGenerateVoiceover?.(video)}
                              disabled={!video.advisor_answer}
                            >
                              Озвучка
                            </Button>
                          )}
                        </div>

                        {/* Video: play + generate combined */}
                        <div className="flex items-center gap-1">
                          {video.heygen_video_url ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button size="xs" variant="outline" title="Смотреть видео">
                                  <VideoIcon className="w-3 h-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-2" side="top">
                                <video
                                  src={video.heygen_video_url}
                                  controls
                                  autoPlay
                                  className="w-full rounded-md"
                                  poster={video.front_cover_url || undefined}
                                />
                              </PopoverContent>
                            </Popover>
                          ) : null}
                          {video.generation_status === 'generating' ? (
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
                              Generate
                            </Button>
                          )}
                        </div>

                        {/* Channels popover */}
                        <div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="xs" variant="ghost" className="h-6 w-6 p-0" title="Каналы публикации">
                                <Send className="w-3 h-3" />
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
      <div className="text-sm text-muted-foreground">
        {filteredVideos.length} из {videos.length} записей
      </div>
    </div>
  );
}
