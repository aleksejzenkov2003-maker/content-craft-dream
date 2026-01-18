import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Mic,
  Square,
  Play,
  Pause,
  Save,
  X,
  Volume2,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeleprompterRecorderProps {
  open: boolean;
  onClose: () => void;
  text: string;
  onSave: (blob: Blob, duration: number) => Promise<void>;
}

export function TeleprompterRecorder({
  open,
  onClose,
  text,
  onSave
}: TeleprompterRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(50);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start audio level visualization
      visualizeAudio();

      // Start auto-scroll
      startAutoScroll();

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopAutoScroll();

      audioContextRef.current?.close();
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  const startAutoScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setIsAutoScrolling(true);
      
      scrollIntervalRef.current = window.setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += scrollSpeed / 50;
        }
      }, 50);
    }
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setIsAutoScrolling(false);
  };

  const handlePlayPause = () => {
    if (!audioUrl) return;

    if (isPlaying && audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      audioElementRef.current = audio;
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setSaving(true);
    await onSave(audioBlob, duration);
    setSaving(false);
    handleClose();
  };

  const handleClose = () => {
    stopRecording();
    stopAutoScroll();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAudioLevel(0);
    onClose();
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold">
            Запись с суфлёром
          </DialogTitle>
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground"
              )} />
              <span className="font-mono text-lg">{formatTime(duration)}</span>
            </div>

            {/* Audio Level */}
            {isRecording && (
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-75"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>
            )}

            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Teleprompter Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 bg-black"
        >
          <div className="max-w-2xl mx-auto">
            <p className="text-3xl leading-relaxed text-white font-medium text-center">
              {text}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center justify-between gap-4">
            {/* Scroll Speed */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Скорость:</span>
              <Slider
                value={[scrollSpeed]}
                onValueChange={([value]) => setScrollSpeed(value)}
                min={10}
                max={100}
                step={10}
                className="w-24"
                disabled={isRecording}
              />
            </div>

            {/* Main Controls */}
            <div className="flex items-center gap-3">
              {!audioBlob ? (
                <>
                  {!isRecording ? (
                    <Button onClick={startRecording} size="lg" className="gap-2">
                      <Mic className="w-5 h-5" />
                      Начать запись
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} size="lg" variant="destructive" className="gap-2">
                      <Square className="w-5 h-5" />
                      Остановить
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handlePlayPause} className="gap-2">
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Пауза
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Прослушать
                      </>
                    )}
                  </Button>

                  <Button variant="outline" onClick={resetRecording} className="gap-2">
                    <Mic className="w-4 h-4" />
                    Перезаписать
                  </Button>

                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </>
              )}
            </div>

            <div className="min-w-[200px]" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
