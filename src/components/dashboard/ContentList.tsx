import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ParsedContent, ContentSource } from '@/types/content';
import { ExternalLink, Youtube, Send, Instagram, Globe, MoreVertical, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const sourceIcons: Record<ContentSource, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceColors: Record<ContentSource, string> = {
  youtube: 'bg-red-500/20 text-red-400 border-red-500/30',
  telegram: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  web: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

interface ContentListProps {
  items: ParsedContent[];
  onSelect?: (id: string) => void;
  onRewrite?: (id: string) => void;
  selectedIds?: string[];
}

export function ContentList({ items, onSelect, onRewrite, selectedIds = [] }: ContentListProps) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const SourceIcon = sourceIcons[item.source];
        const isSelected = selectedIds.includes(item.id);

        return (
          <div
            key={item.id}
            className={cn(
              'group relative rounded-xl p-4 card-gradient border transition-all duration-300',
              'animate-slide-up',
              isSelected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <div className="pt-1">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(item.id)}
                  className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={cn('text-xs', sourceColors[item.source])}>
                    <SourceIcon className="w-3 h-3 mr-1" />
                    {item.source}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.publishedAt, { addSuffix: true, locale: ru })}
                  </span>
                  {item.engagementScore && item.engagementScore >= 8 && (
                    <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                      🔥 Вирусный
                    </Badge>
                  )}
                </div>

                <h4 className="font-semibold text-foreground mb-1 line-clamp-1">{item.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">@{item.channelName}</span>
                  {item.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs bg-muted text-muted-foreground">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRewrite?.(item.id)}
                  className="h-8 w-8 text-primary hover:bg-primary/20"
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
