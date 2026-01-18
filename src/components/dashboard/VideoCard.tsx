import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { VideoProject, VideoStatus } from '@/types/content';
import { Play, Loader2, CheckCircle2, XCircle, Upload, Eye, Mic, Video, Trash2, Settings, Download, Info, ExternalLink, Scissors } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FileUploader } from '@/components/upload/FileUploader';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AvatarSelector } from '@/components/video/AvatarSelector';
import { VoiceSelector } from '@/components/video/VoiceSelector';
import { VideoDetailModal } from '@/components/video/VideoDetailModal';

const statusConfig: Record<VideoStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Ожидает', color: 'bg-muted text-muted-foreground', icon: Play },
  voiceover: { label: 'Озвучка', color: 'bg-info/20 text-info', icon: Mic },
  generating: { label: 'Генерация', color: 'bg-primary/20 text-primary', icon: Loader2 },
  editing: { label: 'Монтаж Submagic', color: 'bg-accent/20 text-accent', icon: Scissors },
  ready: { label: 'Готово', color: 'bg-success/20 text-success', icon: CheckCircle2 },
  published: { label: 'Опубликовано', color: 'bg-info/20 text-info', icon: Upload },
  failed: { label: 'Ошибка', color: 'bg-destructive/20 text-destructive', icon: XCircle },
};


interface ExtendedVideoProject extends VideoProject {
  heygen_video_url?: string | null;
  heygen_video_id?: string | null;
  avatar_id?: string | null;
  error_message?: string | null;
  submagic_project_id?: string | null;
  submagic_video_url?: string | null;
  is_edited?: boolean;
  rewritten_content?: {
    id: string;
    rewritten_text: string;
    hook: string | null;
    cta: string | null;
    script: string | null;
    parsed_content?: {
      id: string;
      title: string;
      content: string | null;
      original_url: string | null;
      channels?: {
        name: string;
        source: string;
      } | null;
    } | null;
  } | null;
}

interface VideoCardProps {
  video: ExtendedVideoProject;
  onPublish?: (id: string) => void;
  onPreview?: (id: string) => void;
  onGenerateVoiceover?: (voiceId?: string, customAudioUrl?: string) => void;
  onCreateVideo?: (avatarId?: string) => void;
  onUploadCustomAudio?: (url: string) => void;
  onUploadCustomVideo?: (url: string) => void;
  onDelete?: (id: string) => void;
  onCheckStatus?: () => void;
  onSendToSubmagic?: () => void;
  onCheckSubmagicStatus?: () => void;
}

export function VideoCard({ 
  video, 
  onPublish, 
  onPreview, 
  onGenerateVoiceover, 
  onCreateVideo,
  onUploadCustomAudio,
  onUploadCustomVideo,
  onDelete,
  onCheckStatus,
  onSendToSubmagic,
  onCheckSubmagicStatus
}: VideoCardProps) {
  const status = statusConfig[video.status];
  const StatusIcon = status.icon;
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [audioSource, setAudioSource] = useState<'elevenlabs' | 'upload' | 'record'>('elevenlabs');
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(video.avatarId || null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);

  // Auto-polling for generating status
  useEffect(() => {
    if (video.status === 'generating' && onCheckStatus) {
      const interval = setInterval(() => {
        onCheckStatus();
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    }
  }, [video.status, onCheckStatus]);

  // Auto-polling for editing status (Submagic)
  useEffect(() => {
    if (video.status === 'editing' && onCheckSubmagicStatus) {
      const interval = setInterval(() => {
        onCheckSubmagicStatus();
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    }
  }, [video.status, onCheckSubmagicStatus]);

  const handleVoiceoverAction = () => {
    if (audioSource === 'elevenlabs' && selectedVoice) {
      onGenerateVoiceover?.(selectedVoice);
    } else if (customAudioUrl) {
      onGenerateVoiceover?.(undefined, customAudioUrl);
    }
  };

  const handleCreateVideo = () => {
    onCreateVideo?.(selectedAvatar || undefined);
    setShowSettings(false);
  };

  const handleDownload = () => {
    // Prioritize edited video URL over original
    const videoUrl = video.submagic_video_url || video.heygen_video_url;
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  // Determine which video URL to display
  const displayVideoUrl = video.submagic_video_url || video.heygen_video_url;

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl overflow-hidden border border-border',
          'hover:border-primary/30 transition-all duration-300 card-gradient'
        )}
      >
        {/* Thumbnail area */}
        <div className="relative aspect-video bg-muted">
          {video.status === 'ready' && displayVideoUrl ? (
            <video
              src={displayVideoUrl}
              className="w-full h-full object-cover"
              muted
              loop
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <Play className="w-12 h-12 text-muted-foreground" />
            </div>
          )}

          {/* Overlay on hover */}
          {video.status === 'ready' && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={() => setShowDetails(true)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Просмотр
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Скачать
              </Button>
            </div>
          )}

          {/* Status badge - show "Смонтировано" for edited videos */}
          {video.is_edited ? (
            <Badge className="absolute top-2 right-2 bg-success/20 text-success">
              <Scissors className="w-3 h-3 mr-1" />
              Смонтировано
            </Badge>
          ) : (
            <Badge className={cn('absolute top-2 right-2', status.color)}>
              <StatusIcon
                className={cn('w-3 h-3 mr-1', (video.status === 'generating' || video.status === 'editing') && 'animate-spin')}
              />
              {status.label}
            </Badge>
          )}

          {/* Settings & Delete buttons */}
          <div className="absolute top-2 left-2 flex gap-1">
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-7 w-7"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-7 w-7"
              onClick={() => setShowDetails(true)}
            >
              <Info className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить видео?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Видео "{video.title}" будет удалено. Это действие нельзя отменить.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => onDelete?.(video.id)}
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Duration */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-xs text-white">
              {video.duration}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-semibold text-foreground line-clamp-2 mb-2">{video.title}</h4>

          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>{formatDistanceToNow(video.createdAt, { addSuffix: true, locale: ru })}</span>
            {video.avatarId && <span>Avatar: {video.avatarId.slice(0, 10)}...</span>}
          </div>

          {/* Progress for generating or editing */}
          {(video.status === 'generating' || video.status === 'voiceover' || video.status === 'editing') && (
            <div className="mb-3">
              <Progress value={video.progress} className="h-1" />
              <p className="text-xs text-muted-foreground mt-1">
                {video.status === 'voiceover' ? 'Генерация озвучки...' : 
                 video.status === 'editing' ? 'Монтаж в Submagic...' : 
                 'Генерация видео...'} {video.progress}%
              </p>
            </div>
          )}

          {/* Error message */}
          {video.error_message && (
            <p className="text-xs text-destructive mb-3 line-clamp-2">{video.error_message}</p>
          )}

          {/* Action buttons for pending */}
          {video.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleVoiceoverAction}>
                <Mic className="w-4 h-4 mr-1" />
                Озвучить
              </Button>
              <Button 
                size="sm" 
                className="flex-1 bg-primary hover:bg-primary/90" 
                onClick={() => setShowSettings(true)}
              >
                <Video className="w-4 h-4 mr-1" />
                Создать
              </Button>
            </div>
          )}

          {/* Send to Submagic button for ready videos that haven't been edited */}
          {video.status === 'ready' && !video.is_edited && onSendToSubmagic && (
            <div className="flex gap-2 mb-3">
              <Button 
                size="sm" 
                className="flex-1 bg-accent hover:bg-accent/90" 
                onClick={onSendToSubmagic}
              >
                <Scissors className="w-4 h-4 mr-1" />
                На монтаж
              </Button>
            </div>
          )}

          {/* Published video link */}
          {video.status === 'published' && video.heygen_video_url && (
            <div className="mt-2">
              <a 
                href={video.heygen_video_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть опубликованное видео
              </a>
            </div>
          )}

          {/* Upload custom video button */}
          {(video.status === 'pending' || video.status === 'failed') && (
            <div className="mt-2">
              <FileUploader
                accept="video/*"
                folder="videos"
                onUpload={(url) => onUploadCustomVideo?.(url)}
                placeholder="Или загрузите готовое видео"
                className="text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройки видео</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Audio source selection */}
            <div className="space-y-3">
              <Label>Источник озвучки</Label>
              <Tabs value={audioSource} onValueChange={(v) => setAudioSource(v as typeof audioSource)}>
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
                  <TabsTrigger value="upload">Загрузить</TabsTrigger>
                  <TabsTrigger value="record">Записать</TabsTrigger>
                </TabsList>

                <TabsContent value="elevenlabs" className="mt-3">
                  <VoiceSelector 
                    selectedVoiceId={selectedVoice}
                    onSelect={setSelectedVoice}
                  />
                </TabsContent>

                <TabsContent value="upload" className="mt-3">
                  <FileUploader
                    accept="audio/*"
                    folder="voiceovers"
                    onUpload={(url) => {
                      setCustomAudioUrl(url);
                      onUploadCustomAudio?.(url);
                    }}
                    placeholder="Загрузите аудиофайл"
                  />
                </TabsContent>

                <TabsContent value="record" className="mt-3">
                  <AudioRecorder
                    onRecordingComplete={(url) => {
                      setCustomAudioUrl(url);
                      onUploadCustomAudio?.(url);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Avatar selection with previews */}
            <div className="space-y-3">
              <Label>Аватар HeyGen</Label>
              <AvatarSelector 
                selectedAvatarId={selectedAvatar}
                onSelect={setSelectedAvatar}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateVideo} disabled={!selectedAvatar}>
              <Video className="w-4 h-4 mr-2" />
              Создать видео
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Details Modal */}
      <VideoDetailModal
        open={showDetails}
        onOpenChange={setShowDetails}
        video={{
          id: video.id,
          title: video.title,
          status: video.status,
          progress: video.progress,
          heygen_video_url: video.heygen_video_url || null,
          heygen_video_id: video.heygen_video_id || null,
          avatar_id: video.avatar_id || null,
          duration: typeof video.duration === 'string' ? parseInt(video.duration) : video.duration || null,
          created_at: video.createdAt.toISOString(),
          error_message: video.error_message,
          submagic_video_url: video.submagic_video_url || null,
          is_edited: video.is_edited || false,
        }}
        rewrittenContent={video.rewritten_content}
        parsedContent={video.rewritten_content?.parsed_content ? {
          id: video.rewritten_content.parsed_content.id,
          title: video.rewritten_content.parsed_content.title,
          content: video.rewritten_content.parsed_content.content,
          original_url: video.rewritten_content.parsed_content.original_url,
          channel_name: video.rewritten_content.parsed_content.channels?.name || null,
          source: video.rewritten_content.parsed_content.channels?.source || null,
        } : undefined}
        onRegenerate={() => {
          setShowDetails(false);
          setShowSettings(true);
        }}
        onSendToSubmagic={!video.is_edited && onSendToSubmagic ? onSendToSubmagic : undefined}
      />
    </>
  );
}
