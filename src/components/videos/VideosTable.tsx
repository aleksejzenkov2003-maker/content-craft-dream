import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  filters,
  onFilterChange,
}: VideosTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set(['__all__']));
  const [sortByAdvisor, setSortByAdvisor] = useState<'asc' | 'desc' | null>('asc');

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

  // Filter by questionId if provided
  const filteredVideos = useMemo(() => {
    if (filters.questionId !== undefined) {
      return videos.filter(v => v.question_id === filters.questionId);
    }
    return videos;
  }, [videos, filters.questionId]);

  // Sort videos by advisor if needed
  const sortedVideos = useMemo(() => {
    if (!sortByAdvisor) return filteredVideos;
    return [...filteredVideos].sort((a, b) => {
      const nameA = a.advisor?.display_name || a.advisor?.name || '';
      const nameB = b.advisor?.display_name || b.advisor?.name || '';
      return sortByAdvisor === 'asc' 
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
  }, [filteredVideos, sortByAdvisor]);

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

  // Get publications for a video grouped by channel
  const getVideoPublications = (videoId: string) => {
    return publications.filter(p => p.video_id === videoId);
  };

  const getCoverStatusBadge = (status: string | null) => {
    const colorClass = coverStatusConfig[status || 'pending'] || coverStatusConfig.pending;
    return <div className={`w-3 h-3 rounded-sm ${colorClass}`} />;
  };

  const getVideoStatusBadge = (status: string | null) => {
    const colorClass = videoStatusConfig[status || 'pending'] || videoStatusConfig.pending;
    return <div className={`w-3 h-3 rounded-sm ${colorClass}`} />;
  };

  const toggleAdvisorSort = () => {
    if (sortByAdvisor === null) setSortByAdvisor('asc');
    else if (sortByAdvisor === 'asc') setSortByAdvisor('desc');
    else setSortByAdvisor(null);
  };

  const isExpanded = (question: string) => expandedQuestions.has('__all__') || expandedQuestions.has(question);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            onFilterChange({ ...filters, status: value === 'all' ? undefined : value })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="generating">In progress</SelectItem>
            <SelectItem value="ready">Completed</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="error">Error</SelectItem>
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
                  <div className="grid grid-cols-[60px_150px_100px_100px_70px_100px_100px_1fr] gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-y border-border/30">
                    <div>ID...</div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAdvisorSort();
                        }}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Духовник
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div>Cover status</div>
                    <div>Video status</div>
                    <div>Длина...</div>
                    <div>Front cover...</div>
                    <div>Video Generate</div>
                    <div>Каналы публикаций</div>
                  </div>

                  {/* Table Rows */}
                  {questionVideos.map((video) => {
                    const videoPubs = getVideoPublications(video.id);
                    return (
                      <div
                        key={video.id}
                        className="grid grid-cols-[60px_150px_100px_100px_70px_100px_100px_1fr] gap-2 px-4 py-2 text-sm hover:bg-muted/30 cursor-pointer border-b border-border/20 items-center"
                        onClick={() => onViewVideo(video)}
                      >
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

                        {/* Cover status */}
                        <div>
                          {getCoverStatusBadge(video.cover_status)}
                        </div>

                        {/* Video status */}
                        <div>
                          {getVideoStatusBadge(video.generation_status)}
                        </div>

                        {/* Duration */}
                        <div className="text-muted-foreground">
                          {video.video_duration ? `${video.video_duration}s` : '—'}
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
        {videos.length} records
      </div>
    </div>
  );
}
