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
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  X,
  Play,
  Sparkles,
  Loader2,
  ExternalLink,
  Calendar,
  Clock,
  Image,
  Send,
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

const coverStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground' },
  generating: { label: 'In progress', color: 'text-yellow-500' },
  ready: { label: 'Completed', color: 'text-green-500' },
  error: { label: 'Error', color: 'text-red-500' },
};

const videoStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground' },
  generating: { label: 'In progress', color: 'text-yellow-500' },
  ready: { label: 'Completed', color: 'text-green-500' },
  published: { label: 'Published', color: 'text-blue-500' },
  error: { label: 'Error', color: 'text-red-500' },
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
  const coverStatus = coverStatusLabels[video.cover_status || 'pending'];
  const videoStatus = videoStatusLabels[video.generation_status || 'pending'];

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Детали ролика</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Header Info */}
            <div className="space-y-2">
              <h3 className="font-medium">{video.video_title || video.question || 'Без заголовка'}</h3>
              {video.hook && (
                <p className="text-sm text-muted-foreground">{video.hook}</p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline">{advisor?.name || 'Без духовника'}</Badge>
                <Badge variant="secondary">{video.playlist?.name || 'Без плейлиста'}</Badge>
              </div>
            </div>

            <Separator />

            {/* Status Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Cover Status</Label>
                <p className={`font-medium ${coverStatus.color}`}>{coverStatus.label}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Video Status</Label>
                <p className={`font-medium ${videoStatus.color}`}>{videoStatus.label}</p>
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
                  onChange={(e) => setPublicationDate(e.target.value)}
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
              {video.front_cover_url && (
                <p className="text-xs text-muted-foreground break-all">{video.front_cover_url}</p>
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
              {video.heygen_video_url && (
                <p className="text-xs text-muted-foreground break-all">{video.heygen_video_url}</p>
              )}
            </div>

            <Separator />

            {/* Back Cover URL */}
            <div>
              <Label className="text-xs text-muted-foreground">Back Cover URL</Label>
              <p className="text-sm mt-1">
                {video.back_cover_url || <span className="text-muted-foreground">—</span>}
              </p>
            </div>

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
