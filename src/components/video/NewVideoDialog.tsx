import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AvatarSelector } from './AvatarSelector';
import { Play, Pause, Volume2, ChevronRight, Video, Loader2, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RewriteForVoiceover } from '@/hooks/useVoiceovers';

export type AspectRatio = '16:9' | '9:16';

interface NewVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readyVoiceovers: RewriteForVoiceover[];
  onCreateVideo: (rewriteId: string, avatarId: string, aspectRatio: AspectRatio) => Promise<void>;
}

export function NewVideoDialog({ open, onOpenChange, readyVoiceovers, onCreateVideo }: NewVideoDialogProps) {
  const [step, setStep] = useState<'voiceover' | 'avatar'>('voiceover');
  const [selectedRewriteId, setSelectedRewriteId] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('9:16');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [creating, setCreating] = useState(false);

  const handlePlayPause = (audioUrl: string, rewriteId: string) => {
    if (playingId === rewriteId && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      setPlayingId(rewriteId);
      setAudioElement(audio);
    }
  };

  const handleSelectVoiceover = (rewriteId: string) => {
    setSelectedRewriteId(rewriteId);
    setStep('avatar');
  };

  const handleBack = () => {
    setStep('voiceover');
    setSelectedAvatarId(null);
  };

  const handleCreate = async () => {
    if (!selectedRewriteId || !selectedAvatarId) return;
    
    setCreating(true);
    try {
      await onCreateVideo(selectedRewriteId, selectedAvatarId, selectedAspectRatio);
      onOpenChange(false);
      // Reset state
      setStep('voiceover');
      setSelectedRewriteId(null);
      setSelectedAvatarId(null);
      setSelectedAspectRatio('9:16');
    } catch (error) {
      // Error handled in hook
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (audioElement) {
      audioElement.pause();
    }
    setPlayingId(null);
    setAudioElement(null);
    setStep('voiceover');
    setSelectedRewriteId(null);
    setSelectedAvatarId(null);
    setSelectedAspectRatio('9:16');
    onOpenChange(false);
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case 'elevenlabs': return 'ElevenLabs';
      case 'recorded': return 'Записано';
      case 'uploaded': return 'Загружено';
      default: return 'Неизвестно';
    }
  };

  const selectedItem = readyVoiceovers.find(item => item.id === selectedRewriteId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'voiceover' ? 'Выберите озвучку' : 'Выберите аватар'}
          </DialogTitle>
        </DialogHeader>

        {step === 'voiceover' && (
          <ScrollArea className="flex-1 max-h-[400px]">
            {readyVoiceovers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет готовых озвучек</p>
                <p className="text-sm mt-2">Создайте озвучку во вкладке "Озвучка"</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {readyVoiceovers.map((item) => {
                  const audioUrl = item.voiceover?.audio_url;
                  const isPlaying = playingId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all',
                        'hover:border-primary/50 hover:bg-muted/50',
                        selectedRewriteId === item.id && 'border-primary bg-primary/5'
                      )}
                      onClick={() => handleSelectVoiceover(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Play button */}
                        {audioUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayPause(audioUrl, item.id);
                            }}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.parsed_content?.title || 'Без названия'}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {item.script || item.rewritten_text}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                              {getSourceLabel(item.voiceover?.audio_source || null)}
                            </span>
                            {item.parsed_content?.channels?.name && (
                              <span className="text-xs text-muted-foreground">
                                {item.parsed_content.channels.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {step === 'avatar' && (
          <div className="flex-1 overflow-hidden">
            {/* Selected voiceover info */}
            {selectedItem && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium truncate">
                  {selectedItem.parsed_content?.title || 'Без названия'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getSourceLabel(selectedItem.voiceover?.audio_source || null)}
                </p>
              </div>
            )}

            {/* Aspect ratio selector */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Формат видео:</p>
              <div className="flex gap-2">
                <Button
                  variant={selectedAspectRatio === '9:16' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAspectRatio('9:16')}
                  className="flex items-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  9:16 (Вертикальное)
                </Button>
                <Button
                  variant={selectedAspectRatio === '16:9' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAspectRatio('16:9')}
                  className="flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  16:9 (Горизонтальное)
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">Выберите аватар для видео:</p>
            <AvatarSelector
              selectedAvatarId={selectedAvatarId}
              onSelect={setSelectedAvatarId}
            />
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          {step === 'avatar' ? (
            <>
              <Button variant="outline" onClick={handleBack} disabled={creating}>
                Назад
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!selectedAvatarId || creating}
                className="bg-primary"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Создать видео
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} className="ml-auto">
              Отмена
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}