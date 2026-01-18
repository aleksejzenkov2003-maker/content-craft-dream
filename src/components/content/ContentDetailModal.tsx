import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Sparkles, Youtube, Send, Instagram, Globe, Calendar, Clock, Edit2, Save, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ContentSource } from '@/types/content';
import { DbParsedContent } from '@/hooks/useParsedContent';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const sourceIcons: Record<ContentSource, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceColors: Record<ContentSource, string> = {
  youtube: 'text-red-400 bg-red-500/20',
  telegram: 'text-blue-400 bg-blue-500/20',
  instagram: 'text-pink-400 bg-pink-500/20',
  web: 'text-emerald-400 bg-emerald-500/20',
};

interface ContentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DbParsedContent | null;
  onRewrite?: (id: string) => void;
  onUpdate?: () => void;
}

export function ContentDetailModal({ open, onOpenChange, item, onRewrite, onUpdate }: ContentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  if (!item) return null;

  const source = (item.channels?.source || 'web') as ContentSource;
  const SourceIcon = sourceIcons[source];

  const handleStartEdit = () => {
    setEditedTitle(item.title);
    setEditedContent(item.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTitle('');
    setEditedContent('');
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('parsed_content')
        .update({
          title: editedTitle,
          content: editedContent
        })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: 'Сохранено',
        description: 'Контент успешно обновлён'
      });

      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить изменения',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRewrite = () => {
    onRewrite?.(item.id);
    onOpenChange(false);
  };

  // Format content for better readability
  const formatContent = (content: string | null) => {
    if (!content) return 'Нет содержания';
    
    // Split by common delimiters and format
    return content
      .replace(/\n{3,}/g, '\n\n')  // Reduce multiple newlines
      .trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${sourceColors[source]}`}>
                <SourceIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium capitalize">{source}</span>
              </div>
              {item.channels?.name && (
                <Badge variant="secondary" className="text-xs">
                  @{item.channels.name}
                </Badge>
              )}
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  (item.relevance_score || 0) >= 70 ? 'bg-success/20 text-success border-success/50' :
                  (item.relevance_score || 0) >= 40 ? 'bg-warning/20 text-warning border-warning/50' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                Релевантность: {Math.round(item.relevance_score || 0)}%
              </Badge>
            </div>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-4 h-4 mr-1" />
                Редактировать
              </Button>
            )}
          </div>
          
          {isEditing ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-lg font-semibold"
              placeholder="Заголовок"
            />
          ) : (
            <DialogTitle className="text-left pr-8">{item.title}</DialogTitle>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="space-y-4">
            {/* Dates */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {item.published_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Опубликовано: {format(new Date(item.published_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Спарсено: {formatDistanceToNow(new Date(item.parsed_at), { addSuffix: true, locale: ru })}</span>
              </div>
            </div>

            {/* Original URL */}
            {item.original_url && (
              <a 
                href={item.original_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть оригинал
              </a>
            )}

            {/* Stats */}
            {(item.views || item.likes || item.comments) && (
              <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                {item.views !== null && item.views !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Просмотры:</span>{' '}
                    <span className="font-medium">{item.views.toLocaleString()}</span>
                  </div>
                )}
                {item.likes !== null && item.likes !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Лайки:</span>{' '}
                    <span className="font-medium">{item.likes.toLocaleString()}</span>
                  </div>
                )}
                {item.comments !== null && item.comments !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Комментарии:</span>{' '}
                    <span className="font-medium">{item.comments.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="space-y-2">
              <Label className="font-medium text-sm text-muted-foreground">Содержание:</Label>
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Содержание контента..."
                />
              ) : (
                <div className="p-4 bg-muted/30 rounded-lg border max-h-[400px] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {formatContent(item.content)}
                  </pre>
                </div>
              )}
            </div>

            {/* Keywords */}
            {!isEditing && item.matched_keywords && Array.isArray(item.matched_keywords) && (item.matched_keywords as string[]).length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium text-sm text-muted-foreground">
                  Найденные ключевые слова ({(item.matched_keywords as string[]).length}):
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {(item.matched_keywords as string[]).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-primary/10 border-primary/30">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Scores */}
            {!isEditing && (
              <div className="flex gap-4 text-sm p-3 bg-muted/30 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Релевантность:</span>{' '}
                  <span className="font-medium">{Math.round(item.relevance_score || 0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Вовлеченность:</span>{' '}
                  <span className="font-medium">{item.engagement_score || 0}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Длина контента:</span>{' '}
                  <span className="font-medium">{(item.content?.length || 0).toLocaleString()} символов</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
              <Button onClick={handleRewrite}>
                <Sparkles className="w-4 h-4 mr-2" />
                Рерайт
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
