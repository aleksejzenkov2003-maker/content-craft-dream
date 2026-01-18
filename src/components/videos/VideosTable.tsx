import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import {
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Image,
  Loader2,
  ExternalLink,
  Plus,
  Upload,
} from 'lucide-react';

interface VideosTableProps {
  videos: Video[];
  advisors: Advisor[];
  playlists: Playlist[];
  loading: boolean;
  onEditVideo: (video: Video) => void;
  onDeleteVideo: (id: string) => void;
  onGenerateVideo: (video: Video) => void;
  onGenerateCover: (video: Video) => void;
  onAddVideo: () => void;
  onImportVideos: () => void;
  filters: {
    advisorId?: string;
    playlistId?: string;
    status?: string;
    search?: string;
  };
  onFilterChange: (filters: any) => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Ожидает', variant: 'secondary' },
  answer_ready: { label: 'Ответ готов', variant: 'outline' },
  cover_ready: { label: 'Обложка готова', variant: 'outline' },
  generating: { label: 'Генерация...', variant: 'default' },
  ready: { label: 'Готово', variant: 'default' },
  published: { label: 'Опубликовано', variant: 'default' },
  error: { label: 'Ошибка', variant: 'destructive' },
};

export function VideosTable({
  videos,
  advisors,
  playlists,
  loading,
  onEditVideo,
  onDeleteVideo,
  onGenerateVideo,
  onGenerateCover,
  onAddVideo,
  onImportVideos,
  filters,
  onFilterChange,
}: VideosTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearch = () => {
    onFilterChange({ ...filters, search: searchInput });
  };

  const getStatusBadge = (status: string | null) => {
    const statusInfo = statusLabels[status || 'pending'] || statusLabels.pending;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
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
            {Object.entries(statusLabels).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={onImportVideos}>
          <Upload className="w-4 h-4 mr-2" />
          Импорт
        </Button>
        <Button onClick={onAddVideo}>
          <Plus className="w-4 h-4 mr-2" />
          Новый ролик
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">№</TableHead>
              <TableHead className="w-[100px]">Обложка</TableHead>
              <TableHead>Заголовок / Хук</TableHead>
              <TableHead>Духовник</TableHead>
              <TableHead>Плейлист</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Соцсети</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Нет роликов
                </TableCell>
              </TableRow>
            ) : (
              videos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell className="font-mono text-sm">
                    {video.video_number || '—'}
                  </TableCell>
                  <TableCell>
                    {video.cover_url ? (
                      <img
                        src={video.cover_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium line-clamp-1">
                        {video.video_title || video.question || 'Без заголовка'}
                      </div>
                      {video.hook && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {video.hook}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {video.advisor?.name || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {video.playlist?.name || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(video.generation_status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {video.tiktok_url && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                          <a href={video.tiktok_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                      {video.youtube_url && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                          <a href={video.youtube_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditVideo(video)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGenerateCover(video)}>
                          <Image className="w-4 h-4 mr-2" />
                          Создать обложку
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGenerateVideo(video)}>
                          <Play className="w-4 h-4 mr-2" />
                          Генерировать видео
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteVideo(video.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Показано {videos.length} роликов
      </div>
    </div>
  );
}
