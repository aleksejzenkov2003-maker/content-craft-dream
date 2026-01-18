import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Mic, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string | null;
}

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
}

export function VoiceSelector({ selectedVoiceId, onSelect }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchVoices();
    return () => {
      if (audioRef) {
        audioRef.pause();
      }
    };
  }, []);

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cached = localStorage.getItem('elevenlabs_voices');
      const cacheTime = localStorage.getItem('elevenlabs_voices_time');
      
      if (cached && cacheTime) {
        const cacheAge = Date.now() - parseInt(cacheTime);
        if (cacheAge < 3600000) { // 1 hour
          setVoices(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke('get-elevenlabs-voices');
      
      if (fnError) throw fnError;
      
      if (data?.success && data.voices) {
        setVoices(data.voices);
        localStorage.setItem('elevenlabs_voices', JSON.stringify(data.voices));
        localStorage.setItem('elevenlabs_voices_time', Date.now().toString());
      } else {
        throw new Error(data?.error || 'Failed to fetch voices');
      }
    } catch (err) {
      console.error('Error fetching voices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;

    if (playingId === voice.voice_id) {
      // Stop playing
      if (audioRef) {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
      setPlayingId(null);
    } else {
      // Start playing
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(voice.preview_url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      setAudioRef(audio);
      setPlayingId(voice.voice_id);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-destructive">
        <p className="text-sm">{error}</p>
        <button 
          onClick={fetchVoices}
          className="text-primary underline text-sm mt-2"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        <p className="text-sm">Нет доступных голосов</p>
      </div>
    );
  }

  // Group voices by category
  const groupedVoices = voices.reduce((acc, voice) => {
    const category = voice.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(voice);
    return acc;
  }, {} as Record<string, ElevenLabsVoice[]>);

  const categoryLabels: Record<string, string> = {
    cloned: 'Клонированные',
    generated: 'Сгенерированные',
    premade: 'Стандартные',
    professional: 'Профессиональные',
    other: 'Другие',
  };

  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto p-1">
      {Object.entries(groupedVoices).map(([category, categoryVoices]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {categoryLabels[category] || category}
          </h4>
          <div className="space-y-2">
            {categoryVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.voice_id;
              const isPlaying = playingId === voice.voice_id;
              
              return (
                <div
                  key={voice.voice_id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer',
                    'border transition-all duration-200',
                    isSelected 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                  onClick={() => onSelect(voice.voice_id)}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isSelected ? 'bg-primary/20' : 'bg-muted'
                  )}>
                    <Mic className={cn(
                      'w-5 h-5',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{voice.name}</p>
                    {voice.labels && Object.keys(voice.labels).length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {Object.values(voice.labels).slice(0, 3).join(' • ')}
                      </p>
                    )}
                  </div>

                  {/* Preview button */}
                  {voice.preview_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreview(voice);
                      }}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  )}

                  {/* Selected indicator */}
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
