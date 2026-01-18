import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Volume2,
  Mic,
  Upload,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RewriteForVoiceover } from '@/hooks/useVoiceovers';
import { TeleprompterRecorder } from './TeleprompterRecorder';
import { AudioUploader } from './AudioUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AvatarSelector } from '@/components/video/AvatarSelector';

interface VoiceoverCardProps {
  item: RewriteForVoiceover;
  onGenerateElevenLabs: (rewriteId: string, text: string) => Promise<void>;
  onSaveRecording: (rewriteId: string, blob: Blob, duration: number) => Promise<void>;
  onUploadAudio: (rewriteId: string, file: File) => Promise<void>;
  onDelete: (rewriteId: string) => Promise<void>;
  onCreateVideo: (rewriteId: string, avatarId: string) => Promise<void>;
}

export function VoiceoverCard({
  item,
  onGenerateElevenLabs,
  onSaveRecording,
  onUploadAudio,
  onDelete,
  onCreateVideo
}: VoiceoverCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [creatingVideo, setCreatingVideo] = useState(false);

  const voiceover = item.voiceover;
  const status = voiceover?.status || 'pending';
  const audioUrl = voiceover?.audio_url;
  const audioSource = voiceover?.audio_source;

  const getScriptText = () => {
    return item.script || item.rewritten_text;
  };

  const handlePlayPause = () => {
    if (!audioUrl) return;

    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  const handleGenerateElevenLabs = async () => {
    setGenerating(true);
    await onGenerateElevenLabs(item.id, getScriptText());
    setGenerating(false);
  };

  const handleRecordingSave = async (blob: Blob, duration: number) => {
    await onSaveRecording(item.id, blob, duration);
    setShowRecorder(false);
  };

  const handleFileUpload = async (file: File) => {
    await onUploadAudio(item.id, file);
    setShowUploader(false);
  };

  const handleCreateVideo = async () => {
    if (!selectedAvatarId) return;
    setCreatingVideo(true);
    try {
      await onCreateVideo(item.id, selectedAvatarId);
      setShowAvatarDialog(false);
      setSelectedAvatarId(null);
    } finally {
      setCreatingVideo(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'ready':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Озвучено
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Генерация...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Ошибка
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <Clock className="w-3 h-3 mr-1" />
            Ожидает
          </Badge>
        );
    }
  };

  const getSourceLabel = () => {
    switch (audioSource) {
      case 'elevenlabs': return 'ElevenLabs (Григорий)';
      case 'recorded': return 'Запись';
      case 'uploaded': return 'Загруженный файл';
      default: return null;
    }
  };

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge()}
                {audioSource && status === 'ready' && (
                  <Badge variant="secondary" className="text-xs">
                    {getSourceLabel()}
                  </Badge>
                )}
              </div>
              <h3 className="font-medium text-foreground truncate">
                {voiceover?.title || item.parsed_content?.title || 'Без названия'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {item.parsed_content?.channels?.name || 'Кастомный текст'}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Audio Player (if ready) */}
          {status === 'ready' && audioUrl && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePlayPause}
                className="h-10 w-10"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              <div className="flex-1">
                <div className="h-1 bg-muted rounded-full">
                  <div className="h-full w-0 bg-primary rounded-full" />
                </div>
              </div>
              {voiceover?.duration_seconds && (
                <span className="text-sm text-muted-foreground">
                  {Math.floor(voiceover.duration_seconds / 60)}:{String(voiceover.duration_seconds % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          )}

          {/* Error message */}
          {status === 'error' && voiceover?.error_message && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {voiceover.error_message}
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-4 space-y-4">
              {/* Script Text */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Текст для озвучки:</h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {getScriptText()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateElevenLabs}
                  disabled={generating || status === 'processing'}
                  className="flex-1 sm:flex-none"
                >
                  {generating || status === 'processing' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4 mr-2" />
                  )}
                  ElevenLabs (Григорий)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowRecorder(true)}
                  disabled={status === 'processing'}
                  className="flex-1 sm:flex-none"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Записать
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowUploader(true)}
                  disabled={status === 'processing'}
                  className="flex-1 sm:flex-none"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить
                </Button>

                {status === 'ready' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(item.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions (collapsed) */}
          {!isExpanded && status !== 'ready' && status !== 'processing' && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={handleGenerateElevenLabs}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Volume2 className="w-3 h-3 mr-1" />
                )}
                Григорий
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsExpanded(true);
                  setTimeout(() => setShowRecorder(true), 100);
                }}
              >
                <Mic className="w-3 h-3 mr-1" />
                Записать
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsExpanded(true);
                  setTimeout(() => setShowUploader(true), 100);
                }}
              >
                <Upload className="w-3 h-3 mr-1" />
                Загрузить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Удалить
              </Button>
            </div>
          )}

          {/* Re-voiceover button for ready items */}
          {!isExpanded && status === 'ready' && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3 mr-1" />
                ) : (
                  <Play className="w-3 h-3 mr-1" />
                )}
                {isPlaying ? 'Пауза' : 'Слушать'}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAvatarDialog(true)}
                className="bg-primary"
              >
                <Video className="w-3 h-3 mr-1" />
                Создать видео
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(true)}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Переозвучить
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teleprompter Modal */}
      <TeleprompterRecorder
        open={showRecorder}
        onClose={() => setShowRecorder(false)}
        text={getScriptText()}
        onSave={handleRecordingSave}
      />

      {/* Upload Modal */}
      <AudioUploader
        open={showUploader}
        onClose={() => setShowUploader(false)}
        onUpload={handleFileUpload}
      />

      {/* Avatar Selection Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Выберите аватар для видео</DialogTitle>
          </DialogHeader>
          <AvatarSelector
            selectedAvatarId={selectedAvatarId}
            onSelect={setSelectedAvatarId}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateVideo}
              disabled={!selectedAvatarId || creatingVideo}
            >
              {creatingVideo ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Video className="w-4 h-4 mr-2" />
              )}
              Создать видео
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
