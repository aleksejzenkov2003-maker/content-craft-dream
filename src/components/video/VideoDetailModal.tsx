import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  Play,
  FileText,
  Calendar,
  Clock,
  User,
  Link2,
  Sparkles,
  Scissors
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface VideoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: {
    id: string;
    title: string;
    status: string;
    progress: number;
    heygen_video_url: string | null;
    heygen_video_id: string | null;
    avatar_id: string | null;
    duration: number | null;
    created_at: string;
    error_message?: string | null;
    submagic_video_url?: string | null;
    is_edited?: boolean;
  };
  rewrittenContent?: {
    id: string;
    rewritten_text: string;
    hook: string | null;
    cta: string | null;
    script: string | null;
  } | null;
  parsedContent?: {
    id: string;
    title: string;
    content: string | null;
    original_url: string | null;
    channel_name: string | null;
    source: string | null;
  } | null;
  onRegenerate?: () => void;
  onSendToSubmagic?: () => void;
}

export function VideoDetailModal({
  open,
  onOpenChange,
  video,
  rewrittenContent,
  parsedContent,
  onRegenerate,
  onSendToSubmagic,
}: VideoDetailModalProps) {
  const { toast } = useToast();

  // Prioritize edited video URL over original
  const displayVideoUrl = video.submagic_video_url || video.heygen_video_url;

  const handleCopyUrl = () => {
    if (displayVideoUrl) {
      navigator.clipboard.writeText(displayVideoUrl);
      toast({ title: 'URL скопирован' });
    }
  };

  const handleDownload = () => {
    if (displayVideoUrl) {
      window.open(displayVideoUrl, '_blank');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            {video.title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Video Player or Status */}
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {video.status === 'ready' && displayVideoUrl ? (
                <video
                  src={displayVideoUrl}
                  className="w-full h-full"
                  controls
                />
              ) : video.status === 'generating' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="animate-pulse">
                    <Play className="w-16 h-16 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Генерация видео... {video.progress}%</p>
                  <div className="w-48 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${video.progress}%` }}
                    />
                  </div>
                </div>
              ) : video.status === 'editing' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="animate-pulse">
                    <Scissors className="w-16 h-16 text-accent" />
                  </div>
                  <p className="text-muted-foreground">Монтаж в Submagic... {video.progress}%</p>
                  <div className="w-48 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all"
                      style={{ width: `${video.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Видео ещё не создано</p>
                </div>
              )}
            </div>

            {/* Edited badge */}
            {video.is_edited && (
              <div className="flex items-center gap-2 text-success">
                <Scissors className="w-4 h-4" />
                <span className="text-sm font-medium">Смонтировано в Submagic</span>
              </div>
            )}

            {/* Actions */}
            {video.status === 'ready' && displayVideoUrl && (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
                <Button variant="outline" onClick={handleCopyUrl}>
                  <Copy className="w-4 h-4 mr-2" />
                  Копировать URL
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(displayVideoUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                
                {/* Send to Submagic button */}
                {!video.is_edited && onSendToSubmagic && (
                  <Button 
                    onClick={onSendToSubmagic}
                    className="w-full mt-2 bg-accent hover:bg-accent/90"
                  >
                    <Scissors className="w-4 h-4 mr-2" />
                    Отправить на монтаж
                  </Button>
                )}
              </div>
            )}

            {video.status === 'pending' && onRegenerate && (
              <Button onClick={onRegenerate} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Сгенерировать видео
              </Button>
            )}

            <Separator />

            {/* Metadata */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Метаданные
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Создано:</span>
                  <span className="text-foreground">
                    {format(new Date(video.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                  </span>
                </div>
                {video.duration && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Длительность:</span>
                    <span className="text-foreground">{formatDuration(video.duration)}</span>
                  </div>
                )}
                {video.avatar_id && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>Аватар:</span>
                    <span className="text-foreground truncate">{video.avatar_id}</span>
                  </div>
                )}
                {video.heygen_video_id && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="w-4 h-4" />
                    <span>HeyGen ID:</span>
                    <span className="text-foreground font-mono text-xs truncate">
                      {video.heygen_video_id}
                    </span>
                  </div>
                )}
              </div>
              {video.error_message && (
                <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  <strong>Ошибка:</strong> {video.error_message}
                </div>
              )}
            </div>

            {/* Rewritten Content */}
            {rewrittenContent && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Рерайт
                  </h4>
                  
                  {rewrittenContent.hook && (
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">Hook</Badge>
                      <p className="text-sm bg-muted p-2 rounded">{rewrittenContent.hook}</p>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">Текст</Badge>
                    <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                      {rewrittenContent.rewritten_text}
                    </p>
                  </div>
                  
                  {rewrittenContent.cta && (
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">CTA</Badge>
                      <p className="text-sm bg-muted p-2 rounded">{rewrittenContent.cta}</p>
                    </div>
                  )}

                  {rewrittenContent.script && (
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">Скрипт</Badge>
                      <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                        {rewrittenContent.script}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Original Content */}
            {parsedContent && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Оригинальный контент
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <p><strong>Заголовок:</strong> {parsedContent.title}</p>
                    {parsedContent.channel_name && (
                      <p><strong>Канал:</strong> {parsedContent.channel_name}</p>
                    )}
                    {parsedContent.source && (
                      <p><strong>Источник:</strong> {parsedContent.source}</p>
                    )}
                    {parsedContent.original_url && (
                      <p>
                        <strong>URL: </strong>
                        <a 
                          href={parsedContent.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {parsedContent.original_url}
                        </a>
                      </p>
                    )}
                    {parsedContent.content && (
                      <div className="mt-2">
                        <strong>Контент:</strong>
                        <p className="mt-1 bg-muted p-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {parsedContent.content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
