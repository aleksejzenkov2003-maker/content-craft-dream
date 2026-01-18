import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown, ChevronUp, Copy, Check, Volume2, Trash2, 
  Youtube, Send, Instagram, Globe, Edit, Save, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RewrittenContentItem } from '@/hooks/useRewrittenContent';

const sourceIcons: Record<string, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceColors: Record<string, string> = {
  youtube: 'text-red-400 bg-red-500/20',
  telegram: 'text-blue-400 bg-blue-500/20',
  instagram: 'text-pink-400 bg-pink-500/20',
  web: 'text-emerald-400 bg-emerald-500/20',
};

interface RewriteCardProps {
  item: RewrittenContentItem;
  onUpdate?: (id: string, updates: Partial<RewrittenContentItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateVoiceover?: (rewriteId: string) => void;
}

export function RewriteCard({ item, onUpdate, onDelete, onCreateVoiceover }: RewriteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(item.rewritten_text);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync editedText when item.rewritten_text changes (after save)
  useEffect(() => {
    setEditedText(item.rewritten_text);
  }, [item.rewritten_text]);

  const source = item.parsed_content?.channels?.source || 'web';
  const SourceIcon = sourceIcons[source] || Globe;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.rewritten_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(item.id, { rewritten_text: editedText });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedText(item.rewritten_text);
    setIsEditing(false);
  };

  return (
    <Card className={cn(
      "transition-all duration-300 overflow-hidden",
      isExpanded && "ring-1 ring-primary/30"
    )}>
      {/* Header - always visible */}
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        {/* Source badge */}
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded shrink-0", sourceColors[source])}>
          <SourceIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium capitalize">{source}</span>
        </div>

        {/* Title and preview */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">
            {item.parsed_content?.title || 'Без названия'}
          </h4>
          <p className="text-sm text-muted-foreground truncate">
            {item.hook || item.rewritten_text?.substring(0, 80) + '...'}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          {item.prompt?.name && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {item.prompt.name}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ru })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 border-t border-border">
          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            {/* Original content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">Оригинал</span>
                <span className="text-xs text-muted-foreground">
                  @{item.parsed_content?.channels?.name}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg max-h-[200px] overflow-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {item.parsed_content?.content || item.parsed_content?.title || '-'}
                </p>
              </div>
            </div>

            {/* Rewritten content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">Рерайт</span>
                {!isEditing && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditing(true)}>
                    <Edit className="w-3 h-3 mr-1" />
                    Редактировать
                  </Button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="w-3 h-3 mr-1" />
                      Отмена
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="w-3 h-3 mr-1" />
                      Сохранить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg max-h-[200px] overflow-auto">
                  <p className="text-sm whitespace-pre-wrap">{item.rewritten_text}</p>
                </div>
              )}
            </div>
          </div>

          {/* Hook and CTA */}
          {(item.hook || item.cta) && (
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {item.hook && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <span className="text-xs font-medium text-success uppercase block mb-1">Хук</span>
                  <p className="text-sm">{item.hook}</p>
                </div>
              )}
              {item.cta && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <span className="text-xs font-medium text-accent uppercase block mb-1">CTA</span>
                  <p className="text-sm">{item.cta}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
              {onCreateVoiceover && (
                <Button variant="outline" size="sm" onClick={() => onCreateVoiceover(item.id)}>
                  <Volume2 className="w-3 h-3 mr-1" />
                  Озвучка
                </Button>
              )}
            </div>
            {onDelete && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Удалить
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
