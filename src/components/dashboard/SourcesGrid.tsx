import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Channel, ContentSource } from '@/types/content';
import { Youtube, Send, Instagram, Globe, MoreVertical, RefreshCw, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const sourceIcons: Record<ContentSource, React.ElementType> = {
  youtube: Youtube,
  telegram: Send,
  instagram: Instagram,
  web: Globe,
};

const sourceGradients: Record<ContentSource, string> = {
  youtube: 'from-red-500/20 to-red-600/5',
  telegram: 'from-blue-500/20 to-blue-600/5',
  instagram: 'from-pink-500/20 to-purple-600/5',
  web: 'from-emerald-500/20 to-teal-600/5',
};

interface SourcesGridProps {
  channels: Channel[];
  onToggle?: (id: string, isActive: boolean) => void;
  onRefresh?: (id: string) => void;
}

export function SourcesGrid({ channels, onToggle, onRefresh }: SourcesGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {channels.map((channel, index) => {
        const SourceIcon = sourceIcons[channel.source];

        return (
          <div
            key={channel.id}
            className={cn(
              'group relative rounded-xl overflow-hidden border border-border',
              'hover:border-primary/30 transition-all duration-300',
              'animate-slide-up'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Gradient background */}
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-50',
                sourceGradients[channel.source]
              )}
            />

            <div className="relative p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-xl',
                      channel.source === 'youtube' && 'bg-red-500/20',
                      channel.source === 'telegram' && 'bg-blue-500/20',
                      channel.source === 'instagram' && 'bg-pink-500/20',
                      channel.source === 'web' && 'bg-emerald-500/20'
                    )}
                  >
                    <SourceIcon
                      className={cn(
                        'w-5 h-5',
                        channel.source === 'youtube' && 'text-red-400',
                        channel.source === 'telegram' && 'text-blue-400',
                        channel.source === 'instagram' && 'text-pink-400',
                        channel.source === 'web' && 'text-emerald-400'
                      )}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground line-clamp-1">{channel.name}</h4>
                    <Badge variant="secondary" className="text-xs mt-1 bg-muted/50">
                      {channel.postsCount} постов
                    </Badge>
                  </div>
                </div>

                <Switch
                  checked={channel.isActive}
                  onCheckedChange={(checked) => onToggle?.(channel.id, checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{channel.url}</p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {channel.lastParsed
                    ? `Обновлено ${formatDistanceToNow(channel.lastParsed, { addSuffix: true, locale: ru })}`
                    : 'Не парсился'}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRefresh?.(channel.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <a href={channel.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
