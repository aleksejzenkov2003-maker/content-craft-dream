import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const coverStatusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  generating: { label: 'In progress', variant: 'outline' },
  ready: { label: 'Completed', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
};

const videoStatusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  generating: { label: 'In progress', variant: 'outline' },
  ready: { label: 'Completed', variant: 'default' },
  published: { label: 'Published', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
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
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [sortByAdvisor, setSortByAdvisor] = useState<'asc' | 'desc' | null>(null);

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

  // Get publication counts per video
  const getVideoPublicationCounts = (videoId: string) => {
    const videoPubs = publications.filter(p => p.video_id === videoId);
    const counts: Record<string, number> = {};
    videoPubs.forEach(pub => {
      const channelName = pub.channel?.name || pub.channel?.network_type || 'Unknown';
      counts[channelName] = (counts[channelName] || 0) + 1;
    });
    return counts;
  };

  const getCoverStatusBadge = (status: string | null) => {
    const statusInfo = coverStatusLabels[status || 'pending'] || coverStatusLabels.pending;
    return <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>;
  };

  const getVideoStatusBadge = (status: string | null) => {
    const statusInfo = videoStatusLabels[status || 'pending'] || videoStatusLabels.pending;
    return <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>;
  };

  const toggleAdvisorSort = () => {
    if (sortByAdvisor === null) setSortByAdvisor('asc');
    else if (sortByAdvisor === 'asc') setSortByAdvisor('desc');
    else setSortByAdvisor(null);
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
            {Object.entries(videoStatusLabels).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
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
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет роликов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedVideos).map(([question, questionVideos]) => (
            <Card key={question} className="glass-card overflow-hidden">
              <Collapsible
                open={expandedQuestions.has(question) || expandedQuestions.size === 0}
                onOpenChange={() => toggleQuestion(question)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedQuestions.has(question) || expandedQuestions.size === 0 ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base font-medium">{question}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{questionVideos.length} роликов</Badge>
                        <Badge variant="outline">
                          {questionVideos.filter(v => v.generation_status === 'ready').length} готово
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[50px]">ID</TableHead>
                          <TableHead className="w-[140px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 -ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAdvisorSort();
                              }}
                            >
                              Духовник
                              <ArrowUpDown className="w-3 h-3 ml-1" />
                            </Button>
                          </TableHead>
                          <TableHead className="w-[120px]">Cover Status</TableHead>
                          <TableHead className="w-[120px]">Video Status</TableHead>
                          <TableHead className="w-[80px]">Длина</TableHead>
                          <TableHead className="w-[120px]">Front cover</TableHead>
                          <TableHead className="w-[120px]">Video</TableHead>
                          <TableHead>Каналы публикаций</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {questionVideos.map((video) => {
                          const pubCounts = getVideoPublicationCounts(video.id);
                          return (
                            <TableRow
                              key={video.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => onViewVideo(video)}
                            >
                              <TableCell className="font-mono text-sm">
                                {video.video_number || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {video.main_photo_url ? (
                                    <img
                                      src={video.main_photo_url}
                                      alt=""
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                      <span className="text-xs">—</span>
                                    </div>
                                  )}
                                  <span className="text-sm truncate max-w-[80px]">
                                    {video.advisor?.display_name || video.advisor?.name || '—'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {getCoverStatusBadge(video.cover_status)}
                              </TableCell>
                              <TableCell>
                                {getVideoStatusBadge(video.generation_status)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {video.video_duration ? `${video.video_duration}s` : '—'}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {video.cover_status === 'ready' && video.front_cover_url ? (
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={video.front_cover_url}
                                      alt=""
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  </div>
                                ) : video.cover_status === 'generating' ? (
                                  <Button size="sm" variant="outline" disabled className="h-8">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    <span className="text-xs">Generating...</span>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => onGenerateCover(video)}
                                  >
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    <span className="text-xs">Generate</span>
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {video.generation_status === 'ready' && video.heygen_video_url ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => window.open(video.heygen_video_url!, '_blank')}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    <span className="text-xs">View</span>
                                  </Button>
                                ) : video.generation_status === 'generating' ? (
                                  <Button size="sm" variant="outline" disabled className="h-8">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    <span className="text-xs">Generating...</span>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => onGenerateVideo(video)}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    <span className="text-xs">Generate</span>
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {Object.keys(pubCounts).length > 0 ? (
                                    Object.entries(pubCounts).map(([name, count]) => (
                                      <Badge 
                                        key={name} 
                                        variant="outline" 
                                        className="text-[10px] px-1.5"
                                      >
                                        {name} {count > 1 ? count : ''}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Показано {sortedVideos.length} роликов в {Object.keys(groupedVideos).length} вопросах
      </div>
    </div>
  );
}
