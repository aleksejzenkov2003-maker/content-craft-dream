import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Video, User, Calendar, ExternalLink } from 'lucide-react';
import { usePublications, Publication } from '@/hooks/usePublications';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type StatusFilter = 'all' | 'waiting' | 'todo' | 'error' | 'in_progress' | 'published';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Запланирован', color: 'bg-info/20 text-info' },
  publishing: { label: 'Публикуется', color: 'bg-warning/20 text-warning' },
  published: { label: 'Опубликован', color: 'bg-success/20 text-success' },
  failed: { label: 'Ошибка', color: 'bg-destructive/20 text-destructive' },
};

interface KanbanCardProps {
  publication: Publication;
}

function KanbanCard({ publication }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: publication.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <Card className="glass-card hover:border-primary/30 transition-colors mb-2">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {publication.video?.question || 'Без названия'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {publication.video?.video_title}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              #{publication.video?.id?.slice(0, 4)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span className="truncate">
              {publication.video?.advisor_id ? 'Духовник' : '—'}
            </span>
          </div>

          {publication.post_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                {format(new Date(publication.post_date), 'dd MMM, HH:mm', { locale: ru })}
              </span>
            </div>
          )}

          {publication.post_url && (
            <a
              href={publication.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              Открыть пост
            </a>
          )}

          <div className="flex items-center justify-between pt-1">
            <Badge
              className={`text-xs ${statusLabels[publication.publication_status]?.color || ''}`}
            >
              {statusLabels[publication.publication_status]?.label || publication.publication_status}
            </Badge>
            {publication.views > 0 && (
              <span className="text-xs text-muted-foreground">
                👁 {publication.views}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  channelId: string;
  channelName: string;
  networkType: string;
  publications: Publication[];
}

function KanbanColumn({ channelId, channelName, networkType, publications }: KanbanColumnProps) {
  const networkIcons: Record<string, string> = {
    youtube: '📺',
    instagram: '📸',
    facebook: '👤',
    tiktok: '🎵',
    telegram: '✈️',
    pinterest: '📌',
    reddit: '🔴',
  };

  return (
    <div className="flex-shrink-0 w-72">
      <Card className="glass-card h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>{networkIcons[networkType] || '📱'}</span>
            <span className="truncate">{channelName}</span>
            <Badge variant="secondary" className="ml-auto">
              {publications.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <SortableContext
              items={publications.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {publications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Нет публикаций
                </div>
              ) : (
                publications.map((pub) => (
                  <KanbanCard key={pub.id} publication={pub} />
                ))
              )}
            </SortableContext>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function PublishingKanban() {
  const { publications, loading, updatePublication } = usePublications();
  const { channels, loading: channelsLoading } = usePublishingChannels();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredPublications = useMemo(() => {
    if (statusFilter === 'all') return publications;

    const statusMap: Record<StatusFilter, string[]> = {
      all: [],
      waiting: ['pending'],
      todo: ['scheduled'],
      error: ['failed'],
      in_progress: ['publishing'],
      published: ['published'],
    };

    return publications.filter((p) =>
      statusMap[statusFilter]?.includes(p.publication_status)
    );
  }, [publications, statusFilter]);

  const publicationsByChannel = useMemo(() => {
    const map = new Map<string, Publication[]>();

    channels.forEach((channel) => {
      map.set(channel.id, []);
    });

    filteredPublications.forEach((pub) => {
      if (pub.channel_id) {
        const existing = map.get(pub.channel_id) || [];
        existing.push(pub);
        map.set(pub.channel_id, existing);
      }
    });

    return map;
  }, [filteredPublications, channels]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    // TODO: Implement status/channel change on drag
  };

  const activePublication = activeId
    ? publications.find((p) => p.id === activeId)
    : null;

  if (loading || channelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">
            Все посты
            <Badge variant="secondary" className="ml-2">
              {publications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="waiting">Ожидает</TabsTrigger>
          <TabsTrigger value="todo">К публикации</TabsTrigger>
          <TabsTrigger value="in_progress">В процессе</TabsTrigger>
          <TabsTrigger value="published">Опубликовано</TabsTrigger>
          <TabsTrigger value="error">Ошибки</TabsTrigger>
        </TabsList>
      </Tabs>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {channels.map((channel) => (
            <KanbanColumn
              key={channel.id}
              channelId={channel.id}
              channelName={channel.name}
              networkType={channel.network_type}
              publications={publicationsByChannel.get(channel.id) || []}
            />
          ))}
        </div>

        <DragOverlay>
          {activePublication ? (
            <Card className="glass-card w-72 shadow-lg">
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">
                  {activePublication.video?.question || 'Без названия'}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
