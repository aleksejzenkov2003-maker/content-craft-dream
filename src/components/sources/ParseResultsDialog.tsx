import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, ThumbsUp, MessageSquare, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { Channel } from '@/types/content';

interface ParsedContentItem {
  id: string;
  title: string;
  content: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  published_at: string | null;
}

interface ParseResultsDialogProps {
  channel: Channel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ParsedContentItem[];
  duplicatesSkipped?: number;
  onNavigateToContent?: () => void;
}

export function ParseResultsDialog({
  channel,
  open,
  onOpenChange,
  results,
  duplicatesSkipped = 0,
  onNavigateToContent,
}: ParseResultsDialogProps) {
  const formatNumber = (num: number | null) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Результаты парсинга
          </DialogTitle>
          <DialogDescription>
            {channel?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Badge variant="secondary" className="text-sm">
            Найдено: {results.length}
          </Badge>
          {duplicatesSkipped > 0 && (
            <Badge variant="outline" className="text-sm">
              <AlertCircle className="w-3 h-3 mr-1" />
              Пропущено дубликатов: {duplicatesSkipped}
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Новых постов не найдено</p>
                <p className="text-sm">Возможно, все посты уже были добавлены ранее</p>
              </div>
            ) : (
              results.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex gap-3">
                      {item.thumbnail_url && (
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="w-20 h-14 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-medium line-clamp-2">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {item.published_at
                            ? format(new Date(item.published_at), 'dd MMM yyyy, HH:mm', { locale: ru })
                            : 'Дата неизвестна'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {item.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {item.content.substring(0, 200)}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(item.views ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {formatNumber(item.views)}
                          </span>
                        )}
                        {(item.likes ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3" />
                            {formatNumber(item.likes)}
                          </span>
                        )}
                        {(item.comments ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {formatNumber(item.comments)}
                          </span>
                        )}
                      </div>
                      {item.original_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          asChild
                        >
                          <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Открыть
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          {results.length > 0 && onNavigateToContent && (
            <Button onClick={() => {
              onOpenChange(false);
              onNavigateToContent();
            }}>
              Перейти к контенту
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
