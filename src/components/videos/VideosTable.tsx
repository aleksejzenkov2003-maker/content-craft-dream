import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { InlineEdit } from '@/components/ui/inline-edit';
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { VideoFilters, VideoFilterState } from './VideoFilters';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import { Publication } from '@/hooks/usePublications';
import {
  Search,
  Loader2,
  Plus,
  Upload,
  ChevronDown,
  ChevronRight,
  Play,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
} from 'lucide-react';

interface VideosTableProps {
  videos: Video[];
  advisors: Advisor[];
  playlists: Playlist[];
  publications: Publication[];
  loading: boolean;
  onEditVideo: (video: Video) => void;
  onDeleteVideo: (id: string) => void;
  onGenerateVideo: (video: Video) => void;
  onGenerateCover: (video: Video) => void;
  onAddVideo: () => void;
  onImportVideos: () => void;
  onViewVideo: (video: Video) => void;
  onUpdateVideo?: (id: string, updates: Partial<Video>) => Promise<void>;
  onBulkDelete?: (videoIds: string[]) => Promise<void>;
  onBulkGenerateCovers?: (videoIds: string[]) => Promise<void>;
  onBulkGenerateVideos?: (videoIds: string[]) => Promise<void>;
  onBulkUpdateStatus?: (videoIds: string[], status: string) => Promise<void>;
  filters: {
    advisorId?: string;
    playlistId?: string;
    status?: string;
    search?: string;
    questionId?: number;
  };
  onFilterChange: (filters: any) => void;
}

const coverStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'error', label: 'Error' },
];

const videoStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'published', label: 'Published' },
  { value: 'error', label: 'Error' },
];

const coverStatusConfig: Record<string, string> = {
  pending: 'bg-muted-foreground/30',
  generating: 'bg-yellow-500',
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

type SortColumn = 'id' | 'advisor' | 'cover_status' | 'video_status' | 'duration' | null;
type SortDirection = 'asc' | 'desc';

export function VideosTable({
  videos,
  advisors,
  playlists,
  publications,
  loading,
  onEditVideo,
  onDeleteVideo,
  onGenerateVideo,
  onGenerateCover,
  onAddVideo,
  onImportVideos,
  onViewVideo,
  onUpdateVideo,
  onBulkDelete,
  onBulkGenerateCovers,
  onBulkGenerateVideos,
  onBulkUpdateStatus,
  filters,
  onFilterChange,
}: VideosTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set(['__all__']));
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

  const handleSearch = () => {
    onFilterChange({ ...filters, search: searchInput });
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

  // Apply advanced filters
  const filteredVideos = useMemo(() => {
    let result = videos;

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

  // Group videos by question
  const groupedVideos = useMemo(() => {
    return sortedVideos.reduce((acc, video) => {
      const question = video.question || 'Без вопроса';
      if (!acc[question]) {
        acc[question] = [];
      }
      acc[question].push(video);
      return acc;
    }, {} as Record<string, Video[]>);
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

  // Inline edit handlers
  const handleCoverStatusChange = async (videoId: string, value: string) => {
    if (onUpdateVideo) {
      await onUpdateVideo(videoId, { cover_status: value });
    }
  };

  const handleVideoStatusChange = async (videoId: string, value: string) => {
    if (onUpdateVideo) {
      await onUpdateVideo(videoId, { generation_status: value });
    }
  };

  const handleDurationChange = async (videoId: string, value: string) => {
    if (onUpdateVideo) {
      await onUpdateVideo(videoId, { video_duration: parseInt(value) || null });
    }
  };

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
      </BulkActionsBar>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Поиск по заголовку, вопросу..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-sm"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <VideoFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} />

        <Select
          value={filters.advisorId || 'all'}
          onValueChange={(value) =>
            onFilterChange({ ...filters, advisorId: value === 'all' ? undefined : value })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Духовник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все духовники</SelectItem>
            {advisors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.playlistId || 'all'}
          onValueChange={(value) =>
            onFilterChange({ ...filters, playlistId: value === 'all' ? undefined : value })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Плейлист" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все плейлисты</SelectItem>
            {playlists.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.questionId !== undefined && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onFilterChange({ ...filters, questionId: undefined })}
          >
            ✕ Сбросить фильтр вопроса
          </Button>
        )}

        <Button variant="outline" onClick={onImportVideos}>
          <Upload className="w-4 h-4 mr-2" />
          Импорт
        </Button>
        <Button onClick={onAddVideo}>
          <Plus className="w-4 h-4 mr-2" />
          Новый ролик
        </Button>
      </div>

      {/* Grouped Table */}
      {Object.keys(groupedVideos).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Play className="w-12 h-12 mb-4" />
          <p>Нет роликов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedVideos).map(([question, questionVideos]) => (
            <div key={question} className="border-b border-border/50">
              <Collapsible
                open={isExpanded(question)}
                onOpenChange={() => toggleQuestion(question)}
              >
                {/* Question Header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 py-2 cursor-pointer hover:bg-muted/30 transition-colors px-2">
                    <Checkbox
                      checked={questionVideos.every(v => selectedVideoIds.has(v.id))}
                      onCheckedChange={() => toggleAllInQuestion(questionVideos)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    {isExpanded(question) ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{question}</span>
                    <span className="text-muted-foreground text-sm ml-2">{questionVideos.length}</span>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_60px_150px_100px_100px_70px_80px_100px_100px_1fr] gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-y border-border/30">
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
                    <div>Front cover</div>
                    <div>Video</div>
                    <div>Каналы</div>
                  </div>

                  {/* Table Rows */}
                  {questionVideos.map((video) => {
                    const videoPubs = getVideoPublications(video.id);
                    const coverUrl = video.front_cover_url || video.cover_url;
                    
                    return (
                      <div
                        key={video.id}
                        className="grid grid-cols-[40px_60px_150px_100px_100px_70px_80px_100px_100px_1fr] gap-2 px-4 py-2 text-sm hover:bg-muted/30 border-b border-border/20 items-center cursor-pointer"
                        onClick={() => onViewVideo(video)}
                      >
                        {/* Checkbox */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedVideoIds.has(video.id)}
                            onCheckedChange={() => toggleVideoSelection(video.id)}
                          />
                        </div>

                        {/* ID */}
                        <div className="font-mono text-xs text-muted-foreground">
                          {video.video_number || '—'}
                        </div>

                        {/* Духовник */}
                        <div>
                          <Badge variant="outline" className="text-xs font-normal">
                            {video.advisor?.display_name || video.advisor?.name || '—'}
                          </Badge>
                        </div>

                        {/* Cover status - inline edit */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <InlineEdit
                            type="select"
                            value={video.cover_status || 'pending'}
                            options={coverStatusOptions}
                            onSave={(value) => handleCoverStatusChange(video.id, value)}
                            className="w-full"
                          />
                        </div>

                        {/* Video status - inline edit */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <InlineEdit
                            type="select"
                            value={video.generation_status || 'pending'}
                            options={videoStatusOptions}
                            onSave={(value) => handleVideoStatusChange(video.id, value)}
                            className="w-full"
                          />
                        </div>

                        {/* Duration - inline edit */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <InlineEdit
                            type="text"
                            value={video.video_duration?.toString() || ''}
                            onSave={(value) => handleDurationChange(video.id, value)}
                            placeholder="—"
                            formatDisplay={(val) => val ? `${val}s` : '—'}
                          />
                        </div>

                        {/* Cover preview */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {coverUrl ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <div className="w-12 h-8 rounded overflow-hidden cursor-pointer border border-border">
                                  <img
                                    src={coverUrl}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 p-2">
                                <img
                                  src={coverUrl}
                                  alt="Cover preview"
                                  className="w-full rounded"
                                />
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Front cover button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {video.cover_status === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="generate-cover"
                              onClick={() => onGenerateCover(video)}
                            >
                              Generate
                            </Button>
                          )}
                        </div>

                        {/* Video Generate button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {video.generation_status === 'generating' ? (
                            <Button size="xs" variant="outline" disabled>
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="generate-video"
                              onClick={() => onGenerateVideo(video)}
                            >
                              Generate
                            </Button>
                          )}
                        </div>

                        {/* Publication channels */}
                        <div className="flex flex-wrap gap-1">
                          {videoPubs.length > 0 ? (
                            videoPubs.map((pub) => (
                              <Badge
                                key={pub.id}
                                variant="secondary"
                                className="text-xs font-normal"
                              >
                                {pub.channel?.name || pub.channel?.network_type}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
