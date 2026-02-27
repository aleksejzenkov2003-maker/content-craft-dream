import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  X,
  Image as ImageIcon,
  Play,
  Pause,
  RefreshCw,
  Check,
  Trash2,
  CalendarIcon,
  Sun,
  Layers,
  Volume2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface VideoSidePanelProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisors: Advisor[];
  publishingChannels: PublishingChannel[];
  onGenerateAtmosphere: (video: Video) => void;
  onGenerateCover: (video: Video) => void;
  onGenerateVideo: (video: Video) => void;
  onGenerateVoiceover?: (video: Video) => void;
  onUpdateVideo: (id: string, updates: Partial<Video>) => void;
  onPublish: (video: Video, channelIds: string[]) => void;
  isGenerating: boolean;
}

const coverStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'atmosphere_ready', label: 'Атмосфера готова' },
  { value: 'ready', label: 'Completed' },
  { value: 'error', label: 'Error' },
];

const videoStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'ready', label: 'Completed' },
  { value: 'published', label: 'Published' },
  { value: 'error', label: 'Error' },
];

export function VideoSidePanel({
  video,
  open,
  onOpenChange,
  advisors,
  publishingChannels,
  onGenerateAtmosphere,
  onGenerateCover,
  onGenerateVideo,
  onGenerateVoiceover,
  onUpdateVideo,
  onPublish,
  isGenerating,
}: VideoSidePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [pubDateOpen, setPubDateOpen] = useState(false);

  const advisor = advisors.find(a => a.id === video?.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

  useEffect(() => {
    const channels = video?.selected_channels;
    if (channels && channels.length > 0) {
      setSelectedChannels(channels);
    } else if (advisor?.default_channels && advisor.default_channels.length > 0) {
      const defaults = advisor.default_channels;
      setSelectedChannels(defaults);
      if (video?.id) {
        onUpdateVideo(video.id, { selected_channels: defaults } as any);
      }
    } else {
      setSelectedChannels([]);
    }
    setAdvisorAnswer(video?.advisor_answer || '');
  }, [video?.id, video?.selected_channels, video?.advisor_answer, advisor]);

  if (!video) return null;

  const handleCoverStatusChange = (value: string) => {
    onUpdateVideo(video.id, { cover_status: value });
  };

  const handleVideoStatusChange = (value: string) => {
    onUpdateVideo(video.id, { generation_status: value });
  };

  const handleChannelToggle = (channelId: string) => {
    const newChannels = selectedChannels.includes(channelId)
      ? selectedChannels.filter(id => id !== channelId)
      : [...selectedChannels, channelId];
    setSelectedChannels(newChannels);
    onUpdateVideo(video.id, { selected_channels: newChannels } as any);
  };

  const handlePublish = () => {
    if (selectedChannels.length > 0) {
      onPublish(video, selectedChannels);
    }
  };

  const handleAdvisorAnswerSave = () => {
    onUpdateVideo(video.id, { advisor_answer: advisorAnswer } as any);
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      onUpdateVideo(video.id, { publication_date: date.toISOString() });
    }
    setPubDateOpen(false);
  };

  const pubDate = video.publication_date ? new Date(video.publication_date) : undefined;
  const atmosphereUrl = (video as any).atmosphere_url;
  const atmospherePrompt = (video as any).atmosphere_prompt;
  const normalizedCoverStatus = video.cover_status === 'generating' && !!video.front_cover_url ? 'ready' : (video.cover_status || 'pending');
  const isGeneratingCover = normalizedCoverStatus === 'generating';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[550px] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-muted rounded">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button className="p-1 hover:bg-muted rounded">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <h3 className="font-medium text-sm flex-1 text-center truncate px-2">
            {video.question} — {advisorName}
          </h3>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-muted rounded">
              <LinkIcon className="w-4 h-4" />
            </button>
            <button 
              className="p-1 hover:bg-muted rounded"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Publication channels */}
            <div>
              <h4 className="font-medium text-sm mb-3">Каналы публикации</h4>
              <div className="flex flex-wrap gap-2">
                {publishingChannels.filter(c => c.is_active).map((channel) => {
                  const isSelected = selectedChannels.includes(channel.id);
                  return (
                    <Badge
                      key={channel.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-colors px-3 py-1.5",
                        isSelected 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "hover:bg-muted"
                      )}
                      onClick={() => handleChannelToggle(channel.id)}
                    >
                      {channel.name}
                    </Badge>
                  );
                })}
              </div>
              {selectedChannels.length > 0 && (
                <Button className="w-full mt-4" onClick={handlePublish}>
                  Публикация ({selectedChannels.length})
                </Button>
              )}
            </div>

            <Separator className="my-4" />

            {/* Advisor answer */}
            <div className="space-y-2">
              <Label className="text-sm">Ответ духовника</Label>
              <Textarea
                value={advisorAnswer}
                onChange={(e) => setAdvisorAnswer(e.target.value)}
                onBlur={handleAdvisorAnswerSave}
                placeholder="Введите ответ духовника..."
                className="min-h-[100px] text-sm"
              />
            </div>

            {/* Publication date */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Плановая публикация</Label>
              <Popover open={pubDateOpen} onOpenChange={setPubDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left text-sm", !pubDate && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3 mr-2" />
                    {pubDate ? format(pubDate, 'dd.MM.yyyy HH:mm', { locale: ru }) : 'Выбрать дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pubDate}
                    onSelect={handleDateChange}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Separator className="my-4" />

            {/* === VOICEOVER SECTION === */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" />
                  Озвучка
                </h4>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => onGenerateVoiceover?.(video)}
                  disabled={video.voiceover_status === 'generating' || !video.advisor_answer}
                >
                  {video.voiceover_status === 'generating' ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Генерация...
                    </>
                  ) : video.voiceover_url ? (
                    'Перегенерировать'
                  ) : (
                    'Сгенерировать'
                  )}
                </Button>
              </div>

              {/* Audio player */}
              {video.voiceover_url && (
                <audio controls className="w-full h-8" src={video.voiceover_url}>
                  Your browser does not support the audio element.
                </audio>
              )}

              {!video.voiceover_url && video.voiceover_status !== 'generating' && (
                <div className="py-4 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                  <Volume2 className="w-5 h-5 text-muted-foreground/30" />
                  <span className="text-[10px] text-muted-foreground/40">Озвучка не сгенерирована</span>
                </div>
              )}

              {/* Voiceover status */}
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Статус</Label>
                <Select
                  value={video.voiceover_status || 'pending'}
                  onValueChange={(value) => onUpdateVideo(video.id, { voiceover_status: value } as any)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="generating">In progress</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Обложка</h4>
              
              {/* Two generation buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  onClick={() => onGenerateAtmosphere(video)}
                  disabled={isGeneratingCover}
                >
                  {isGeneratingCover ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sun className="w-3 h-3 mr-1" />
                  )}
                  Шаг 1: Фон
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-orange-500/50 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  onClick={() => onGenerateCover(video)}
                  disabled={isGeneratingCover || !atmosphereUrl}
                >
                  {isGeneratingCover ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Layers className="w-3 h-3 mr-1" />
                  )}
                  Шаг 2: Обложка
                </Button>
              </div>

              {/* Side-by-side previews: Atmosphere + Final Cover */}
              <div className="grid grid-cols-2 gap-3">
                {/* Atmosphere (Step 1) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sun className="w-3 h-3" />
                    Фон (атмосфера)
                  </Label>
                  {atmosphereUrl ? (
                    <div className="relative aspect-[9/16] rounded-lg overflow-hidden border bg-muted group cursor-pointer"
                         onClick={() => window.open(atmosphereUrl, '_blank')}>
                      <img src={atmosphereUrl} alt="Atmosphere" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                      <Sun className="w-5 h-5 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/40">Нет фона</span>
                    </div>
                  )}
                  {atmospherePrompt && (
                    <p className="text-[9px] text-muted-foreground/60 italic line-clamp-2">{atmospherePrompt}</p>
                  )}
                </div>

                {/* Final Cover (Step 2) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Обложка (финал)
                  </Label>
                  {video.front_cover_url ? (
                    <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-primary bg-muted group cursor-pointer"
                         onClick={() => window.open(video.front_cover_url!, '_blank')}>
                      <img src={video.front_cover_url} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="absolute top-1 right-1">
                        <Badge className="text-[8px] px-1 py-0 bg-primary">Active</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/40">Нет обложки</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover status */}
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Статус</Label>
                <Select
                  value={normalizedCoverStatus}
                  onValueChange={handleCoverStatusChange}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {coverStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            {/* === VIDEO SECTION === */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Видео</h4>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onGenerateVideo(video)}
                  disabled={video.generation_status === 'generating' || isGenerating || !video.voiceover_url}
                  title={!video.voiceover_url ? 'Сначала создайте озвучку' : undefined}
                >
                  {video.generation_status === 'generating' || isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : !video.voiceover_url ? (
                    'Нужна озвучка'
                  ) : (
                    'Generate Video'
                  )}
                </Button>
              </div>

              {/* Video Player */}
              {video.heygen_video_url ? (
                <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                  <video 
                    src={video.heygen_video_url} 
                    controls 
                    className="w-full h-full object-contain"
                    poster={video.front_cover_url || undefined}
                  />
                </div>
              ) : (
                <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Play className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <span className="text-xs text-muted-foreground/40">Видео не сгенерировано</span>
                </div>
              )}

              {/* Video status */}
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Статус</Label>
                <Select
                  value={video.generation_status || 'pending'}
                  onValueChange={handleVideoStatusChange}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Meta fields */}
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Cover URL</Label>
                <Input
                  value={video.front_cover_url || ''}
                  onChange={(e) => onUpdateVideo(video.id, { front_cover_url: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Video URL</Label>
                <div className="text-xs text-muted-foreground truncate">
                  {video.heygen_video_url || '—'}
                </div>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <Label className="text-xs text-muted-foreground">Длительность</Label>
                <div className="text-xs text-muted-foreground">
                  {video.video_duration ? `${video.video_duration}s` : '—'}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
