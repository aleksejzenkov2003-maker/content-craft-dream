import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { MoreVertical, Eye, Trash2, ExternalLink, Calendar, Send } from 'lucide-react';
import { Publication, usePublications } from '@/hooks/usePublications';
import { usePublishingChannels, PublishingChannel } from '@/hooks/usePublishingChannels';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Ожидает', variant: 'secondary' },
  scheduled: { label: 'Запланирован', variant: 'outline' },
  published: { label: 'Опубликован', variant: 'default' },
  failed: { label: 'Ошибка', variant: 'destructive' },
};

interface PublicationsTableProps {
  groupBy?: 'channel' | 'question';
}

export function PublicationsTable({ groupBy = 'channel' }: PublicationsTableProps) {
  const { publications, loading, deletePublication } = usePublications();
  const { channels } = usePublishingChannels();
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const filteredPublications = publications.filter((pub) => {
    if (filterChannel && filterChannel !== 'all' && pub.channel_id !== filterChannel) return false;
    if (filterStatus && filterStatus !== 'all' && pub.publication_status !== filterStatus) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (confirm('Удалить публикацию?')) {
      await deletePublication(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusLabels[status] || statusLabels.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Group publications
  const groupedPublications = filteredPublications.reduce((acc, pub) => {
    const key = groupBy === 'channel' 
      ? pub.channel?.name || 'Без канала'
      : pub.video?.question || 'Без вопроса';
    
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(pub);
    return acc;
  }, {} as Record<string, Publication[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterChannel || 'all'} onValueChange={(v) => setFilterChannel(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все каналы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все каналы</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидает</SelectItem>
            <SelectItem value="scheduled">Запланирован</SelectItem>
            <SelectItem value="published">Опубликован</SelectItem>
            <SelectItem value="failed">Ошибка</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {Object.keys(groupedPublications).length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет публикаций</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedPublications).map(([groupName, pubs]) => (
          <Card key={groupName} className="glass-card">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">{groupName}</h3>
                <p className="text-sm text-muted-foreground">{pubs.length} публикаций</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Видео</TableHead>
                    {groupBy !== 'channel' && <TableHead>Канал</TableHead>}
                    <TableHead>Дата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Просмотры</TableHead>
                    <TableHead className="text-right">Лайки</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pubs.map((pub) => (
                    <TableRow key={pub.id}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">
                            {pub.video?.video_title || 'Без названия'}
                          </p>
                        </div>
                      </TableCell>
                      {groupBy !== 'channel' && (
                        <TableCell>
                          <Badge variant="outline">{pub.channel?.name}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {pub.post_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(pub.post_date), 'dd MMM yyyy, HH:mm', { locale: ru })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(pub.publication_status)}</TableCell>
                      <TableCell className="text-right">
                        {pub.views > 0 ? pub.views.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {pub.likes > 0 ? pub.likes.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {pub.post_url && (
                              <DropdownMenuItem asChild>
                                <a href={pub.post_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Открыть пост
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(pub.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
