import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, Trash2, ExternalLink, RefreshCw, Youtube, Send, Instagram, Globe, 
  Check, X, Search, ChevronDown 
} from 'lucide-react';
import { ContentSource, Channel } from '@/types/content';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ParseOptionsDialog } from './ParseOptionsDialog';
import { ParseResultsDialog } from './ParseResultsDialog';

const sourceConfig: Record<ContentSource, { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  disabledReason?: string;
}> = {
  youtube: { 
    icon: Youtube, 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/20',
    label: 'YouTube',
    placeholder: 'https://www.youtube.com/@channel'
  },
  telegram: { 
    icon: Send, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    label: 'Telegram',
    placeholder: 'https://t.me/channel'
  },
  instagram: { 
    icon: Instagram, 
    color: 'text-pink-400', 
    bgColor: 'bg-pink-500/20',
    label: 'Instagram',
    placeholder: 'https://instagram.com/account',
    disabled: true,
    disabledReason: 'Требуется Instagram API'
  },
  web: { 
    icon: Globe, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20',
    label: 'Web',
    placeholder: 'https://site.com/rss'
  },
};

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

interface ParseResult {
  success: boolean;
  items: ParsedContentItem[];
  duplicatesSkipped: number;
}

interface SourcesManagerProps {
  channels: Channel[];
  onAdd?: (channel: Omit<Channel, 'id' | 'lastParsed' | 'postsCount'>) => void;
  onRemove?: (id: string) => void;
  onToggle?: (id: string, isActive: boolean) => void;
  onRefresh?: (id: string, daysBack?: number) => Promise<ParseResult>;
  onRefreshAll?: (source: ContentSource, daysBack: number) => void;
  onNavigateToContent?: () => void;
}

export function SourcesManager({ 
  channels, 
  onAdd, 
  onRemove, 
  onToggle, 
  onRefresh,
  onRefreshAll,
  onNavigateToContent
}: SourcesManagerProps) {
  const [activeTab, setActiveTab] = useState<ContentSource>('youtube');
  const [isAdding, setIsAdding] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', url: '', rssUrl: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Parse dialogs state
  const [parseOptionsOpen, setParseOptionsOpen] = useState(false);
  const [parseResultsOpen, setParseResultsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [parseResults, setParseResults] = useState<ParsedContentItem[]>([]);
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const filteredChannels = channels
    .filter(c => c.source === activeTab)
    .filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const stats = {
    total: channels.filter(c => c.source === activeTab).length,
    active: channels.filter(c => c.source === activeTab && c.isActive).length,
    totalPosts: channels
      .filter(c => c.source === activeTab)
      .reduce((sum, c) => sum + c.postsCount, 0),
  };

  const handleAdd = () => {
    if (newChannel.name && newChannel.url) {
      onAdd?.({
        name: newChannel.name,
        source: activeTab,
        url: newChannel.url,
        rssUrl: newChannel.rssUrl || undefined,
        isActive: true,
      });
      setNewChannel({ name: '', url: '', rssUrl: '' });
      setIsAdding(false);
    }
  };

  const handleOpenParseOptions = (channel: Channel) => {
    setSelectedChannel(channel);
    setParseOptionsOpen(true);
  };

  const handleParse = async (channelId: string, daysBack: number) => {
    setIsParsing(true);
    setParseOptionsOpen(false);
    
    try {
      const result = await onRefresh?.(channelId, daysBack);
      if (result) {
        setParseResults(result.items);
        setDuplicatesSkipped(result.duplicatesSkipped);
        setParseResultsOpen(true);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const config = sourceConfig[activeTab];
  const Icon = config.icon;

  return (
    <div className="rounded-xl card-gradient border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Управление источниками</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-48 pl-9 bg-secondary/50"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ContentSource)}>
        <div className="border-b border-border">
          <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
            {(Object.keys(sourceConfig) as ContentSource[]).map(source => {
              const cfg = sourceConfig[source];
              const SourceIcon = cfg.icon;
              const count = channels.filter(c => c.source === source).length;
              
              return (
                <TabsTrigger
                  key={source}
                  value={source}
                  disabled={cfg.disabled}
                  className={cn(
                    "relative h-12 px-4 rounded-none border-b-2 border-transparent",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent",
                    "data-[state=active]:shadow-none",
                    cfg.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  title={cfg.disabled ? cfg.disabledReason : undefined}
                >
                  <SourceIcon className={cn("w-4 h-4 mr-2", cfg.color)} />
                  {cfg.label}
                  {cfg.disabled ? (
                    <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                      Недоступен
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Всего:</span>{' '}
              <span className="font-medium">{stats.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Активных:</span>{' '}
              <span className="font-medium text-success">{stats.active}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Постов:</span>{' '}
              <span className="font-medium">{stats.totalPosts}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить все
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 7)}>
                  7 дней
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 14)}>
                  14 дней
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 30)}>
                  30 дней
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 60)}>
                  60 дней
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 90)}>
                  3 месяца
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 180)}>
                  6 месяцев
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRefreshAll?.(activeTab, 365)}>
                  1 год
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Add new form */}
          {isAdding && (
            <div className="mb-4 p-4 rounded-lg bg-muted/50 border border-border animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("w-5 h-5", config.color)} />
                <span className="font-medium">Новый источник {config.label}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <Input
                  value={newChannel.name}
                  onChange={e => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Название канала"
                  className="bg-background"
                />
                <Input
                  value={newChannel.url}
                  onChange={e => setNewChannel(prev => ({ ...prev, url: e.target.value }))}
                  placeholder={config.placeholder}
                  className="bg-background"
                />
                <Input
                  value={newChannel.rssUrl}
                  onChange={e => setNewChannel(prev => ({ ...prev, rssUrl: e.target.value }))}
                  placeholder="RSS URL (опционально)"
                  className="bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAdd}>
                  <Check className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  <X className="w-4 h-4 mr-1" />
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium text-center">Посты</th>
                  <th className="px-4 py-3 font-medium">Последний парсинг</th>
                  <th className="px-4 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredChannels.map((channel, index) => (
                  <tr 
                    key={channel.id}
                    className="hover:bg-muted/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <Switch
                        checked={channel.isActive}
                        onCheckedChange={checked => onToggle?.(channel.id, checked)}
                        className="data-[state=checked]:bg-success"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded", config.bgColor)}>
                          <Icon className={cn("w-3.5 h-3.5", config.color)} />
                        </div>
                        <span className="font-medium">{channel.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a 
                        href={channel.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary truncate block max-w-[200px]"
                      >
                        {channel.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{channel.postsCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {channel.lastParsed 
                        ? formatDistanceToNow(channel.lastParsed, { addSuffix: true, locale: ru })
                        : 'Никогда'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenParseOptions(channel)}
                          disabled={isParsing}
                        >
                          <RefreshCw className={cn("w-4 h-4", isParsing && selectedChannel?.id === channel.id && "animate-spin")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={channel.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onRemove?.(channel.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredChannels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      <Icon className={cn("w-8 h-8 mx-auto mb-2 opacity-50", config.color)} />
                      <p>Нет источников {config.label}</p>
                      <Button 
                        variant="link" 
                        className="mt-2"
                        onClick={() => setIsAdding(true)}
                      >
                        Добавить первый источник
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Tabs>

      {/* Parse Options Dialog */}
      <ParseOptionsDialog
        channel={selectedChannel}
        open={parseOptionsOpen}
        onOpenChange={setParseOptionsOpen}
        onParse={handleParse}
        isLoading={isParsing}
      />

      {/* Parse Results Dialog */}
      <ParseResultsDialog
        channel={selectedChannel}
        open={parseResultsOpen}
        onOpenChange={setParseResultsOpen}
        results={parseResults}
        duplicatesSkipped={duplicatesSkipped}
        onNavigateToContent={onNavigateToContent}
      />
    </div>
  );
}
