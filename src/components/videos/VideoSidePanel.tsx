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
  RefreshCw,
  Check,
  Trash2,
  CalendarIcon,
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
  onGenerateCover: (video: Video) => void;
  onGenerateVideo: (video: Video) => void;
  onUpdateVideo: (id: string, updates: Partial<Video>) => void;
  onPublish: (video: Video, channelIds: string[]) => void;
  isGenerating: boolean;
}

const coverStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
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
  onGenerateCover,
  onGenerateVideo,
  onUpdateVideo,
  onPublish,
  isGenerating,
}: VideoSidePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [pubDateOpen, setPubDateOpen] = useState(false);

  // Initialize state from video data when video changes
  useEffect(() => {
    setSelectedChannels(video?.selected_channels || []);
    setAdvisorAnswer(video?.advisor_answer || '');
  }, [video?.id, video?.selected_channels, video?.advisor_answer]);

  if (!video) return null;

  const advisor = advisors.find(a => a.id === video.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

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
            {/* Publication channels - moved to top */}
            <div>
              <h4 className="font-medium text-sm mb-3">Каналы публикации</h4>
              <div className="flex flex-wrap gap-2">
                {publishingChannels.map((channel) => {
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
              
              {/* Publish button */}
              {selectedChannels.length > 0 && (
                <Button
                  className="w-full mt-4"
                  onClick={handlePublish}
                >
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

            {/* Publication date - editable */}
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

            {/* Front Cover Generate */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Front Cover</Label>
              <Button
                size="sm"
                className="w-fit h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => onGenerateCover(video)}
                disabled={video.cover_status === 'generating'}
              >
                {video.cover_status === 'generating' ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Cover'
                )}
              </Button>
            </div>

            {/* Cover Gallery */}
            <div className="space-y-2">
              <Label className="text-sm">Галерея обложек</Label>
              <div className="grid grid-cols-3 gap-2">
                {video.front_cover_url ? (
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-primary bg-muted group cursor-pointer">
                    <img 
                      src={video.front_cover_url} 
                      alt="Cover" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="absolute top-1 right-1">
                      <Badge className="text-[9px] px-1 py-0 bg-primary">Active</Badge>
                    </div>
                  </div>
                ) : null}
                {[...Array(video.front_cover_url ? 2 : 3)].map((_, i) => (
                  <div 
                    key={i}
                    className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  >
                    <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/50">Пусто</span>
                  </div>
                ))}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => onGenerateCover(video)}
                disabled={video.cover_status === 'generating'}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Сгенерировать ещё
              </Button>
            </div>

            {/* Cover status */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Cover status</Label>
              <Select
                value={video.cover_status || 'pending'}
                onValueChange={handleCoverStatusChange}
              >
                <SelectTrigger className="h-8">
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

            {/* Video Generate */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Video</Label>
              <Button
                size="sm"
                className="w-fit h-7 text-xs bg-green-500 hover:bg-green-600 text-white"
                onClick={() => onGenerateVideo(video)}
                disabled={video.generation_status === 'generating' || isGenerating}
              >
                {video.generation_status === 'generating' || isGenerating ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Video'
                )}
              </Button>
            </div>

            {/* Video Player - same aspect ratio as cover */}
            <div className="space-y-2">
              <Label className="text-sm">Видео</Label>
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
                <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Play className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <span className="text-xs text-muted-foreground/50">Видео не сгенерировано</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs mt-2"
                    onClick={() => onGenerateVideo(video)}
                    disabled={video.generation_status === 'generating' || isGenerating}
                  >
                    {video.generation_status === 'generating' || isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Генерация...
                      </>
                    ) : (
                      'Сгенерировать видео'
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Video status */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Video status</Label>
              <Select
                value={video.generation_status || 'pending'}
                onValueChange={handleVideoStatusChange}
              >
                <SelectTrigger className="h-8">
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

            {/* Front cover URL */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Front cover URL</Label>
              <Input
                value={video.front_cover_url || ''}
                onChange={(e) => onUpdateVideo(video.id, { front_cover_url: e.target.value })}
                placeholder=""
                className="h-8 text-sm"
              />
            </div>

            {/* Video URL */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Video URL</Label>
              <div className="text-sm text-muted-foreground">
                {video.heygen_video_url || '—'}
              </div>
            </div>

            {/* Duration */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Длина ролика</Label>
              <div className="text-sm text-muted-foreground">
                {video.video_duration ? `${video.video_duration}s` : '—'}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
