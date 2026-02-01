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
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, User, Calendar, ExternalLink, Eye, AlertCircle, Send, RotateCcw } from 'lucide-react';
import { usePublications, Publication } from '@/hooks/usePublications';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

// Status columns configuration
const STATUS_COLUMNS = [
  { id: 'pending', label: 'Ожидает', color: 'bg-muted' },
  { id: 'scheduled', label: 'К публикации', color: 'bg-info/20' },
  { id: 'publishing', label: 'В процессе', color: 'bg-warning/20' },
  { id: 'published', label: 'Опубликовано', color: 'bg-success/20' },
  { id: 'failed', label: 'Ошибки', color: 'bg-destructive/20' },
] as const;

type StatusId = typeof STATUS_COLUMNS[number]['id'];

const networkIcons: Record<string, string> = {
  youtube: '📺',
  instagram: '📸',
  facebook: '👤',
  tiktok: '🎵',
  telegram: '✈️',
  pinterest: '📌',
  reddit: '🔴',
};

interface KanbanCardProps {
  publication: Publication;
  onPublish?: () => void;
  onRetry?: () => void;
}

function KanbanCard({ publication, onPublish, onRetry }: KanbanCardProps) {
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

  const channelIcon = publication.channel?.network_type 
    ? networkIcons[publication.channel.network_type] || '📱' 
    : '📱';

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
          {/* Channel and title */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">{channelIcon}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {publication.channel?.name || 'Без канала'}
                </span>
              </div>
              <p className="text-sm font-medium truncate">
                {publication.video?.video_title || publication.video?.question || 'Без названия'}
              </p>
              {publication.video?.video_number && (
                <p className="text-xs text-muted-foreground">
                  Ролик #{publication.video.video_number}
                </p>
              )}
            </div>
            {publication.post_url && (
              <a
                href={publication.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3 text-primary" />
              </a>
            )}
          </div>

          {/* Advisor */}
          {publication.video?.advisor && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate">
                {publication.video.advisor.display_name || publication.video.advisor.name}
              </span>
            </div>
          )}

          {/* Post date */}
          {publication.post_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                {format(new Date(publication.post_date), 'dd MMM, HH:mm', { locale: ru })}
              </span>
            </div>
          )}

          {/* Views */}
          {publication.views > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>{publication.views.toLocaleString()}</span>
            </div>
          )}

          {/* Error message */}
          {publication.publication_status === 'failed' && publication.error_message && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-destructive cursor-help">
                    <AlertCircle className="w-3 h-3" />
                    <span className="truncate">Ошибка</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{publication.error_message}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
            {publication.publication_status === 'scheduled' && onPublish && (
              <Button 
                size="xs" 
                variant="publish"
                onClick={onPublish}
                className="h-6 text-xs"
              >
                <Send className="w-3 h-3 mr-1" />
                Опубликовать
              </Button>
            )}
            {publication.publication_status === 'failed' && onRetry && (
              <Button 
                size="xs" 
                variant="outline"
                onClick={onRetry}
                className="h-6 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Повторить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatusColumnProps {
  status: typeof STATUS_COLUMNS[number];
  publications: Publication[];
  onPublish: (id: string) => void;
  onRetry: (id: string) => void;
}

function StatusColumn({ status, publications, onPublish, onRetry }: StatusColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  return (
    <div className="flex-shrink-0 w-72">
      <Card className={`glass-card h-full transition-colors ${isOver ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className={`pb-2 ${status.color} rounded-t-lg`}>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="truncate">{status.label}</span>
            <Badge variant="secondary" className="ml-auto">
              {publications.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2" ref={setNodeRef}>
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
                  <KanbanCard 
                    key={pub.id} 
                    publication={pub}
                    onPublish={() => onPublish(pub.id)}
                    onRetry={() => onRetry(pub.id)}
                  />
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

  const publicationsByStatus = useMemo(() => {
    const map = new Map<StatusId, Publication[]>();

    STATUS_COLUMNS.forEach((col) => {
      map.set(col.id, []);
    });

    publications.forEach((pub) => {
      const status = pub.publication_status as StatusId;
      const existing = map.get(status) || map.get('pending')!;
      existing.push(pub);
    });

    // Sort by post_date within each column
    map.forEach((pubs) => {
      pubs.sort((a, b) => {
        if (!a.post_date && !b.post_date) return 0;
        if (!a.post_date) return 1;
        if (!b.post_date) return -1;
        return new Date(a.post_date).getTime() - new Date(b.post_date).getTime();
      });
    });

    return map;
  }, [publications]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const publicationId = active.id as string;
    const newStatus = over.id as string;

    // Check if dropped on a status column
    const isStatusColumn = STATUS_COLUMNS.some(col => col.id === newStatus);
    if (!isStatusColumn) return;

    // Find current publication
    const publication = publications.find(p => p.id === publicationId);
    if (!publication) return;

    // Don't update if same status
    if (publication.publication_status === newStatus) return;

    try {
      await updatePublication(publicationId, { publication_status: newStatus });
      const statusLabel = STATUS_COLUMNS.find(s => s.id === newStatus)?.label || newStatus;
      toast.success(`Статус изменён на "${statusLabel}"`);
    } catch (error) {
      console.error('Failed to update publication status:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  const handlePublish = async (publicationId: string) => {
    try {
      await updatePublication(publicationId, { publication_status: 'publishing' });
      toast.success('Публикация запущена');
    } catch (error) {
      toast.error('Ошибка запуска публикации');
    }
  };

  const handleRetry = async (publicationId: string) => {
    try {
      await updatePublication(publicationId, { 
        publication_status: 'scheduled',
        error_message: null 
      });
      toast.success('Публикация добавлена в очередь');
    } catch (error) {
      toast.error('Ошибка повтора публикации');
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Канбан публикаций</span>
          <Badge variant="secondary">{publications.length} публикаций</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          Перетащите карточку в нужную колонку для смены статуса
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => (
            <StatusColumn
              key={status.id}
              status={status}
              publications={publicationsByStatus.get(status.id) || []}
              onPublish={handlePublish}
              onRetry={handleRetry}
            />
          ))}
        </div>

        <DragOverlay>
          {activePublication ? (
            <Card className="glass-card w-72 shadow-lg rotate-3">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm">
                    {activePublication.channel?.network_type 
                      ? networkIcons[activePublication.channel.network_type] || '📱' 
                      : '📱'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activePublication.channel?.name}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">
                  {activePublication.video?.video_title || activePublication.video?.question || 'Без названия'}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
