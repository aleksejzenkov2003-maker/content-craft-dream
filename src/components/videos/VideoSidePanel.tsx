import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';

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

  // Reset selectedChannels when video changes
  useEffect(() => {
    setSelectedChannels([]);
  }, [video?.id]);

  if (!video) return null;

  const advisor = advisors.find(a => a.id === video.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

  const formatPublicationDate = () => {
    if (!video.publication_date) return '—';
    try {
      const date = new Date(video.publication_date);
      return format(date, 'yyyy-MM-dd HH:mm xxx');
    } catch {
      return video.publication_date;
    }
  };

  const handleCoverStatusChange = (value: string) => {
    onUpdateVideo(video.id, { cover_status: value });
  };

  const handleVideoStatusChange = (value: string) => {
    onUpdateVideo(video.id, { generation_status: value });
  };

  const handleAddChannel = (channelId: string) => {
    if (!selectedChannels.includes(channelId)) {
      setSelectedChannels([...selectedChannels, channelId]);
    }
  };

  const handleRemoveChannel = (channelId: string) => {
    setSelectedChannels(selectedChannels.filter(id => id !== channelId));
  };

  const handlePublish = () => {
    if (selectedChannels.length > 0) {
      onPublish(video, selectedChannels);
      setSelectedChannels([]);
    }
  };

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
            {/* Publication date */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <Label className="text-sm">Publication date</Label>
              <div className="text-sm">{formatPublicationDate()}</div>
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
                  'Generate'
                )}
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
                  'Generate'
                )}
              </Button>
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

            {/* Field deleted placeholder */}
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="text-yellow-600">⚠</span>
              Field deleted
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

            <Separator className="my-4" />

            {/* Publication channels */}
            <div>
              <h4 className="font-medium text-sm mb-3">Publication channels</h4>
              <div className="space-y-2">
                {/* Existing channels from publications would go here */}
                {selectedChannels.map((channelId) => {
                  const channel = publishingChannels.find(c => c.id === channelId);
                  if (!channel) return null;
                  return (
                    <div
                      key={channelId}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <span className="text-sm">{channel.name}</span>
                      <button
                        onClick={() => handleRemoveChannel(channelId)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Add channel button */}
                <div className="relative">
                  <Select onValueChange={handleAddChannel}>
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="w-4 h-4" />
                        Add record
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {publishingChannels
                        .filter(c => !selectedChannels.includes(c.id))
                        .map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name} ({channel.network_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Publish button */}
                {selectedChannels.length > 0 && (
                  <Button
                    className="w-full mt-3"
                    onClick={handlePublish}
                  >
                    Опубликовать ({selectedChannels.length})
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
