import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { MoreVertical, Trash2, ExternalLink, Calendar, Send, Sparkles, Loader2, FileSpreadsheet } from 'lucide-react';
import { Publication, usePublications } from '@/hooks/usePublications';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { useVideos } from '@/hooks/useVideos';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CsvImporter, Lookups } from '@/components/import/CsvImporter';
import { PUBLICATION_COLUMN_MAPPING, PUBLICATION_PREVIEW_COLUMNS } from '@/components/import/importConfigs';

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
  const { publications, loading, deletePublication, generateText, bulkImport } = usePublications();
  const { channels } = usePublishingChannels();
  const { videos } = useVideos();
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showImporter, setShowImporter] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());

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

  const getStatusBadge = (status: string) => {
    const config = statusLabels[status] || statusLabels.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPublicationTitle = (pub: Publication) => {
    const question = pub.video?.question || 'Без вопроса';
    const advisor = pub.video?.advisor?.display_name || pub.video?.advisor?.name || 'Духовник';
    return `${question} — ${advisor}`;
  };

  const groupedPublications = filteredPublications.reduce((acc, pub) => {
    let key: string;
    if (groupBy === 'channel') {
      key = pub.channel?.name || 'Без канала';
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
    
    // Resolve video by video_number
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
    
    // Resolve channel by name
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

        <div className="flex-1" />

        <Button variant="outline" onClick={() => setShowImporter(true)}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Импорт CSV
        </Button>
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
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{groupName}</h3>
                    {groupBy === 'channel' && networkType && (
                      <Badge variant="outline">{networkType}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{pubs.length} публикаций</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Заголовок публикации</TableHead>
                    <TableHead className="w-[80px]">ID Ролика</TableHead>
                    {groupBy !== 'channel' && <TableHead className="w-[120px]">Канал</TableHead>}
                    <TableHead className="w-[150px]">Дата</TableHead>
                    <TableHead className="w-[80px]">Длина</TableHead>
                    <TableHead className="w-[100px]">Статус</TableHead>
                    <TableHead className="w-[80px] text-right">Просмотры</TableHead>
                    <TableHead className="w-[80px] text-right">Лайки</TableHead>
                    <TableHead className="w-[200px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pubs.map((pub) => (
                    <TableRow key={pub.id}>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="font-medium truncate" title={getPublicationTitle(pub)}>
                            {getPublicationTitle(pub)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {pub.video?.video_number || '—'}
                        </Badge>
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
                            <span className="text-sm">
                              {format(new Date(pub.post_date), 'dd MMM yyyy, HH:mm', { locale: ru })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pub.video?.video_duration ? (
                          <span className="text-sm">{pub.video.video_duration}s</span>
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
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!pub.generated_text || generatingIds.has(pub.id)}
                            onClick={() => handleGenerateText(pub)}
                            className="h-8"
                          >
                            {generatingIds.has(pub.id) ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 mr-1" />
                            )}
                            <span className="text-xs">Generate</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={pub.publication_status === 'published' || publishingIds.has(pub.id)}
                            onClick={() => handlePublish(pub)}
                            className="h-8"
                          >
                            {publishingIds.has(pub.id) ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3 mr-1" />
                            )}
                            <span className="text-xs">Publish</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
      />
    </div>
  );
}
