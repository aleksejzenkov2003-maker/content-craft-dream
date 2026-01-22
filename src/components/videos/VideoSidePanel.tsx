import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
  Play,
  Sparkles,
  Loader2,
  ExternalLink,
  Calendar,
  Clock,
  Image,
  Send,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'text-muted-foreground';
    case 'generating': return 'text-yellow-500';
    case 'ready': return 'text-green-500';
    case 'published': return 'text-blue-500';
    case 'error': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
};

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
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [publicationDate, setPublicationDate] = useState('');

  if (!video) return null;

  const advisor = advisors.find(a => a.id === video.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

  const toggleChannel = (channelId: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId);
    } else {
      newSelected.add(channelId);
    }
    setSelectedChannels(newSelected);
  };

  const handlePublish = () => {
    if (selectedChannels.size > 0) {
      onPublish(video, Array.from(selectedChannels));
    }
  };

  const handleCoverStatusChange = (value: string) => {
    onUpdateVideo(video.id, { cover_status: value });
  };

  const handleVideoStatusChange = (value: string) => {
    onUpdateVideo(video.id, { generation_status: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-lg">
            {video.question} — {advisorName}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Header Info */}
            <div className="space-y-2">
              {video.hook && (
                <p className="text-sm text-muted-foreground italic">"{video.hook}"</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{advisorName}</Badge>
                <Badge variant="secondary">{video.playlist?.name || 'Без плейлиста'}</Badge>
                {video.video_number && (
                  <Badge variant="secondary">#{video.video_number}</Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Advisor Answer Section */}
            {video.advisor_answer && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <Label>Ответ духовника</Label>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{video.advisor_answer}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Status Section with Dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cover Status</Label>
                <Select
                  value={video.cover_status || 'pending'}
                  onValueChange={handleCoverStatusChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {coverStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={getStatusColor(option.value)}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Video Status</Label>
                <Select
                  value={video.generation_status || 'pending'}
                  onValueChange={handleVideoStatusChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={getStatusColor(option.value)}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Publication Date */}
            <div>
              <Label className="text-xs text-muted-foreground">Publication Date</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={publicationDate || (video.publication_date ? video.publication_date.slice(0, 16) : '')}
                  onChange={(e) => {
                    setPublicationDate(e.target.value);
                    onUpdateVideo(video.id, { publication_date: e.target.value });
                  }}
                  className="flex-1"
                />
              </div>
            </div>

            <Separator />

            {/* Front Cover Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Front Cover</Label>
                {video.cover_status !== 'ready' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerateCover(video)}
                    disabled={video.cover_status === 'generating'}
                  >
                    {video.cover_status === 'generating' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                )}
              </div>
              {video.front_cover_url ? (
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={video.front_cover_url}
                    alt="Front cover"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Image className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <Separator />

            {/* Video Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Video</Label>
                {video.generation_status !== 'ready' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerateVideo(video)}
                    disabled={video.generation_status === 'generating' || isGenerating}
                  >
                    {video.generation_status === 'generating' || isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                )}
              </div>
              {video.heygen_video_url ? (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={video.heygen_video_url}
                      controls
                      className="w-full h-full"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(video.heygen_video_url!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Открыть в новой вкладке
                  </Button>
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <Separator />

            {/* Duration */}
            <div>
              <Label className="text-xs text-muted-foreground">Длина ролика</Label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{video.video_duration ? `${video.video_duration} сек` : '—'}</span>
              </div>
            </div>

            <Separator />

            {/* Publication Channels */}
            <div className="space-y-3">
              <Label>Каналы публикации</Label>
              <div className="space-y-2">
                {publishingChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет каналов публикации</p>
                ) : (
                  publishingChannels.map((channel) => (
                    <div key={channel.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={channel.id}
                        checked={selectedChannels.has(channel.id)}
                        onCheckedChange={() => toggleChannel(channel.id)}
                      />
                      <label
                        htmlFor={channel.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {channel.name} ({channel.network_type})
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Publish Button */}
            <Button
              className="w-full"
              disabled={selectedChannels.size === 0 || video.generation_status !== 'ready'}
              onClick={handlePublish}
            >
              <Send className="w-4 h-4 mr-2" />
              Опубликовать ({selectedChannels.size})
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
