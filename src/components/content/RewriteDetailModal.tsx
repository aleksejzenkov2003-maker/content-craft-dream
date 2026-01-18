import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, Check, Video, Edit2, Save, X, ExternalLink, 
  Clock, FileText, Sparkles, Trash2 
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RewrittenContentItem } from '@/hooks/useRewrittenContent';

interface RewriteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RewrittenContentItem | null;
  onUpdate?: (id: string, updates: Partial<RewrittenContentItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateVideo?: (script: string) => void;
}

export function RewriteDetailModal({
  isOpen,
  onClose,
  item,
  onUpdate,
  onDelete,
  onCreateVideo,
}: RewriteDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState('');
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const handleEdit = () => {
    setEditedScript(item.rewritten_text || item.script || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (onUpdate) {
      await onUpdate(item.id, { rewritten_text: editedScript, script: editedScript });
    }
    setIsEditing(false);
  };

  const handleCopy = () => {
    const text = item.rewritten_text || item.script || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (onDelete && confirm('Удалить этот результат рерайта?')) {
      await onDelete(item.id);
      onClose();
    }
  };

  const sourceLabel = item.parsed_content?.channels?.source || 'unknown';
  const channelName = item.parsed_content?.channels?.name || 'Неизвестный канал';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {item.parsed_content?.title || 'Результат рерайта'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{sourceLabel}</Badge>
              <span>@{channelName}</span>
              <span>•</span>
              <Clock className="w-4 h-4" />
              <span>{format(new Date(item.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}</span>
              {item.prompt && (
                <>
                  <span>•</span>
                  <FileText className="w-4 h-4" />
                  <span>Промпт: {item.prompt.name}</span>
                </>
              )}
            </div>

            {/* Original content */}
            {item.parsed_content && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">Оригинал</h4>
                  {item.parsed_content.original_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.parsed_content.original_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Источник
                      </a>
                    </Button>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h5 className="font-medium mb-2">{item.parsed_content.title}</h5>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.parsed_content.content}
                  </p>
                </div>
              </div>
            )}

            {/* Rewritten content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium gradient-text">Результат рерайта</h4>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4 mr-1" />
                        Отмена
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        <Save className="w-4 h-4 mr-1" />
                        Сохранить
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleEdit}>
                        <Edit2 className="w-4 h-4 mr-1" />
                        Редактировать
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copied ? 'Скопировано' : 'Копировать'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Hook */}
              {item.hook && !isEditing && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-xs text-primary font-medium">ХУК</span>
                  <p className="mt-1">{item.hook}</p>
                </div>
              )}

              {/* Main script */}
              {isEditing ? (
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <span className="text-xs text-muted-foreground font-medium">СКРИПТ</span>
                  <p className="mt-2 whitespace-pre-wrap">
                    {item.rewritten_text || item.script}
                  </p>
                </div>
              )}

              {/* CTA */}
              {item.cta && !isEditing && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <span className="text-xs text-success font-medium">ПРИЗЫВ К ДЕЙСТВИЮ</span>
                  <p className="mt-1">{item.cta}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => {
                  onCreateVideo?.(item.rewritten_text || item.script || '');
                  onClose();
                }}
              >
                <Video className="w-4 h-4 mr-2" />
                Создать видео
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
