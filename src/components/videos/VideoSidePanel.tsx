import { useState, useEffect, useCallback } from 'react';
import { UnifiedPanel, PanelField, PanelSection } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  Loader2, ChevronLeft, ChevronRight, Link as LinkIcon,
  Image as ImageIcon, Play, Check, Trash2, Copy,
  Sun, Layers, Volume2, MessageSquare, Subtitles, X, ExternalLink, RefreshCw,
  Minimize2, Square, MonitorPlay,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatFileSize } from '@/components/publishing/videoMetadata';

interface CoverVariant {
  id: string;
  atmosphere_url: string | null;
  front_cover_url: string | null;
  prompt: string | null;
  variant_type: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface VideoVariant {
  id: string;
  video_id: string;
  heygen_video_id: string | null;
  heygen_video_url: string | null;
  reduced_video_url: string | null;
  video_path: string | null;
  is_active: boolean | null;
  generation_number: number | null;
  created_at: string;
}

interface VideoSidePanelProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisors: Advisor[];
  publishingChannels: PublishingChannel[];
  onGenerateAtmosphere: (video: Video, customPrompt?: string) => void;
  onGenerateCover: (video: Video) => void;
  onGenerateVideo: (video: Video) => void;
  onGenerateVoiceover?: (video: Video) => void;
  onUpdateVideo: (id: string, updates: Partial<Video>) => void;
  onPublish: (video: Video, channelIds: string[]) => void;
  isGenerating: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  autoSubtitleProgress?: { phase: string; progress: number } | null;
  onCancelAutoProcess?: () => void;
  onNavigateToScene?: (playlistId: string, advisorId: string) => void;
}

/* Status resolution for asset badges */
function resolveAssetStatus(url: string | null | undefined, statusField: string | null | undefined): { label: string; colorClass: string } {
  if (url) return { label: 'Ready', colorClass: 'bg-green-500 text-white' };
  if (statusField === 'generating') return { label: 'In progress', colorClass: 'bg-yellow-500 text-white' };
  if (statusField === 'error' || statusField === 'failed') return { label: 'Error', colorClass: 'bg-destructive text-destructive-foreground' };
  return { label: 'Pending', colorClass: 'bg-muted-foreground/60 text-white' };
}

export function VideoSidePanel({
  video, open, onOpenChange, advisors, publishingChannels,
  onGenerateAtmosphere, onGenerateCover, onGenerateVideo, onGenerateVoiceover,
  onUpdateVideo, onPublish, isGenerating, onPrev, onNext, autoSubtitleProgress,
  onCancelAutoProcess, onNavigateToScene,
}: VideoSidePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [atmosphereVariants, setAtmosphereVariants] = useState<CoverVariant[]>([]);
  const [coverVariants, setCoverVariants] = useState<CoverVariant[]>([]);
  const [atmosIndex, setAtmosIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [atmospherePromptText, setAtmospherePromptText] = useState('');
  const [processState, setProcessState] = useState<{ type: 'bitrate' | 'overlay' | 'subtitles'; phase: string; progress: number } | null>(null);
  const [processAbort, setProcessAbort] = useState<AbortController | null>(null);
  const [highlightMode, setHighlightMode] = useState(true);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [videoSizeBytes, setVideoSizeBytes] = useState<number | null>(null);
  const [heygenMode, setHeygenMode] = useState<string>('v3');
  const [localBusy, setLocalBusy] = useState<'atmosphere' | 'cover' | 'video' | null>(null);
  const [videoVariantsDb, setVideoVariantsDb] = useState<VideoVariant[]>([]);
  const [vidVariantIndex, setVidVariantIndex] = useState(0);

  const advisor = advisors.find((a) => a.id === video?.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

  const fetchVariants = useCallback(async () => {
    if (!video?.id) return;
    const [coverRes, vidVarRes] = await Promise.all([
      supabase.from('cover_thumbnails').select('*').eq('video_id', video.id).order('created_at', { ascending: false }),
      (supabase.from('video_variants' as any) as any).select('*').eq('video_id', video.id).order('created_at', { ascending: false }),
    ]);
    if (coverRes.data) {
      const atmos = coverRes.data.filter((d: any) => d.variant_type === 'atmosphere');
      const covers = coverRes.data.filter((d: any) => d.variant_type === 'cover' || !d.variant_type);
      setAtmosphereVariants(atmos as CoverVariant[]);
      setCoverVariants(covers as CoverVariant[]);
      setAtmosIndex(atmos.findIndex((a: any) => a.is_active) >= 0 ? atmos.findIndex((a: any) => a.is_active) : 0);
      setCoverIndex(covers.findIndex((c: any) => c.is_active) >= 0 ? covers.findIndex((c: any) => c.is_active) : 0);
    }
    if (vidVarRes.data) {
      setVideoVariantsDb(vidVarRes.data as VideoVariant[]);
      const activeIdx = (vidVarRes.data as VideoVariant[]).findIndex((v: any) => v.is_active);
      setVidVariantIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  }, [video?.id]);

  // FFmpeg preloading removed — processing happens on VPS

  useEffect(() => { fetchVariants(); }, [fetchVariants, (video as any)?.atmosphere_url, video?.front_cover_url, video?.heygen_video_url, video?.video_path]);

  // Reset local busy when server status changes
  useEffect(() => {
    setLocalBusy(null);
  }, [video?.cover_status, video?.generation_status, video?.voiceover_status, video?.reel_status]);

  useEffect(() => {
    const channels = video?.selected_channels;
    if (channels && channels.length > 0) setSelectedChannels(channels);
    else if (advisor?.default_channels && advisor.default_channels.length > 0) {
      const defaults = advisor.default_channels;
      setSelectedChannels(defaults);
      if (video?.id) onUpdateVideo(video.id, { selected_channels: defaults } as any);
    } else setSelectedChannels([]);
    setAdvisorAnswer(video?.advisor_answer || '');
    setIsReady((video as any)?.is_ready || false);
  }, [video?.id, video?.selected_channels, video?.advisor_answer, advisor]);

  // Cleanup: abort running process on video switch or panel close
  useEffect(() => {
    return () => {
      if (processAbort) {
        processAbort.abort();
        setProcessState(null);
        setProcessAbort(null);
      }
    };
  }, [video?.id, open]);

  // Fetch heygen_mode setting
  useEffect(() => {
    supabase.from('app_settings' as any).select('value').eq('key', 'heygen_mode').single()
      .then(({ data }) => { if (data) setHeygenMode((data as any).value); });
  }, []);


  useEffect(() => {
    const fetchAtmospherePrompt = async () => {
      if (!video?.id) return;
      const { data: dbPrompt } = await supabase.from('prompts').select('system_prompt, user_template').eq('type', 'atmosphere').eq('is_active', true).limit(1).single();
      if (dbPrompt) {
        const filled = dbPrompt.user_template
          .replace(/\{\{question\}\}/g, video.question || '')
          .replace(/\{\{hook\}\}/g, video.hook || '')
          .replace(/\{\{answer\}\}/g, video.advisor_answer || '')
          .replace(/\{\{advisor\}\}/g, advisorName)
          .replace(/\{\{playlist\}\}/g, '');
        setAtmospherePromptText(filled);
      }
    };
    fetchAtmospherePrompt();
  }, [video?.id, video?.question, video?.hook, video?.advisor_answer, advisor]);

  const [videoIndex, setVideoIndex] = useState(0);

  // Build video variants for carousel
  const videoVariants = (() => {
    if (!video) return [];
    const variants: { label: string; url: string }[] = [];
    const seen = new Set<string>();
    const add = (label: string, url: string | null | undefined) => {
      if (url && !seen.has(url)) { seen.add(url); variants.push({ label, url }); }
    };
    add('HeyGen видео', video.heygen_video_url);
    add('Сжатое видео', video.reduced_video_url);
    // video_path with subtitles (only if different from reduced)
    if (video.video_path && video.word_timestamps && video.video_path !== video.reduced_video_url) {
      add('С субтитрами', video.video_path);
    } else if (video.video_path && !video.reduced_video_url && video.video_path !== video.heygen_video_url) {
      // video_path exists but no reduced — it's the compressed or final version
      add('Сжатое видео', video.video_path);
    }
    return variants;
  })();

  // Reset video index when variants change
  useEffect(() => {
    setVideoIndex(Math.max(0, videoVariants.length - 1));
  }, [video?.video_path, video?.heygen_video_url]);

  const videoUrl = videoVariants.length > 0 ? videoVariants[Math.min(videoIndex, videoVariants.length - 1)]?.url : null;
  const currentVideoLabel = videoVariants.length > 0 ? videoVariants[Math.min(videoIndex, videoVariants.length - 1)]?.label : null;
  const [originalSizeBytes, setOriginalSizeBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setVideoSizeBytes(null);
      setOriginalSizeBytes(null);
      return;
    }

    let cancelled = false;

    const probeSize = async (url: string): Promise<number | null> => {
      try {
        let response = await fetch(url, { method: 'HEAD' });
        let contentLength = response.headers.get('content-length');
        if (!contentLength) {
          response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          const contentRange = response.headers.get('content-range');
          const totalFromRange = contentRange?.split('/')[1];
          contentLength = totalFromRange || response.headers.get('content-length');
        }
        return contentLength ? Number(contentLength) : null;
      } catch {
        return null;
      }
    };

    const resolve = async () => {
      const heygenUrl = video?.heygen_video_url || null;
      const hasReduced = video?.video_path && heygenUrl && video.video_path !== heygenUrl;

      const [finalSize, origSize] = await Promise.all([
        probeSize(videoUrl),
        hasReduced ? probeSize(heygenUrl) : Promise.resolve(null),
      ]);

      if (!cancelled) {
        setVideoSizeBytes(finalSize);
        setOriginalSizeBytes(origSize);
      }
    };

    resolve();

    return () => { cancelled = true; };
  }, [videoUrl, video?.heygen_video_url, video?.video_path]);

  if (!video) return null;

  const handleChannelToggle = (channelId: string) => {
    const newChannels = selectedChannels.includes(channelId) ? selectedChannels.filter((id) => id !== channelId) : [...selectedChannels, channelId];
    setSelectedChannels(newChannels);
    onUpdateVideo(video.id, { selected_channels: newChannels } as any);
  };
  const handlePublish = () => { if (selectedChannels.length > 0) onPublish(video, selectedChannels); };
  const handleAdvisorAnswerSave = () => onUpdateVideo(video.id, { advisor_answer: advisorAnswer } as any);

  const handleSelectVariant = async (variant: CoverVariant, type: 'atmosphere' | 'cover') => {
    try {
      await supabase.from('cover_thumbnails').update({ is_active: false }).eq('video_id', video.id).eq('variant_type', type);
      await supabase.from('cover_thumbnails').update({ is_active: true }).eq('id', variant.id);
      if (type === 'atmosphere') onUpdateVideo(video.id, { atmosphere_url: variant.atmosphere_url } as any);
      else onUpdateVideo(video.id, { front_cover_url: variant.front_cover_url } as any);
      fetchVariants();
      toast.success('Вариант выбран');
    } catch (e) { toast.error('Ошибка выбора варианта'); }
  };

  const handleDeleteVariant = async (variant: CoverVariant, type: 'atmosphere' | 'cover') => {
    try {
      await supabase.from('cover_thumbnails').delete().eq('id', variant.id);
      fetchVariants();
      toast.success('Вариант удалён');
    } catch (e) { toast.error('Ошибка удаления'); }
  };

  const handleSelectVideoVariant = async (variant: VideoVariant) => {
    try {
      await (supabase.from('video_variants' as any) as any).update({ is_active: false }).eq('video_id', video.id);
      await (supabase.from('video_variants' as any) as any).update({ is_active: true }).eq('id', variant.id);
      onUpdateVideo(video.id, {
        heygen_video_url: variant.heygen_video_url,
        heygen_video_id: variant.heygen_video_id,
        reduced_video_url: variant.reduced_video_url,
        video_path: variant.video_path,
      } as any);
      fetchVariants();
      toast.success('Вариант видео выбран');
    } catch (e) { toast.error('Ошибка выбора варианта'); }
  };

  const handleDeleteVideoVariant = async (variant: VideoVariant) => {
    try {
      await (supabase.from('video_variants' as any) as any).delete().eq('id', variant.id);
      fetchVariants();
      toast.success('Вариант удалён');
    } catch (e) { toast.error('Ошибка удаления'); }
  };

  const atmosphereUrl = (video as any).atmosphere_url;
  const normalizedCoverStatus = video.cover_status === 'generating' && !!video.front_cover_url ? 'ready' : video.cover_status || 'pending';
  const isGeneratingCover = normalizedCoverStatus === 'generating';
  const hasGeneratedVideo = !!(video.video_path || video.heygen_video_url);
  const effectiveGenerationStatus = video.generation_status === 'generating' && hasGeneratedVideo ? 'ready' : video.generation_status;
  const effectiveReelStatus = video.reel_status === 'generating' && !!video.video_path ? 'ready' : video.reel_status;
  const isProcessLocked = !!processState || !!autoSubtitleProgress;

  const atmosStatus = resolveAssetStatus(atmosphereUrl, video.cover_status);
  const coverStatus = resolveAssetStatus(video.front_cover_url, video.cover_status);
  const videoStatus = resolveAssetStatus(video.video_path || video.heygen_video_url, effectiveGenerationStatus);

  const effectiveDuration = video.video_duration || detectedDuration;
  const durationFormatted = effectiveDuration ? `${Math.floor(effectiveDuration / 60)}:${String(Math.round(effectiveDuration % 60)).padStart(2, '0')}` : '—';
  const sizeFormatted = videoSizeBytes ? `${(videoSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '—';

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur)) {
      const roundedDuration = Math.round(dur);
      setDetectedDuration(roundedDuration);
      if (!video.video_duration) {
        supabase.from('videos').update({ video_duration: roundedDuration }).eq('id', video.id).then();
      }
    }
  };

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div>
          <span>{`#${video.video_number || '—'} ${video.question || ''} — ${advisorName}`}</span>
          {video.playlist?.name && (
            <button
              className="block text-xs text-primary hover:underline cursor-pointer mt-0.5 text-left font-normal"
              onClick={() => {
                if (onNavigateToScene && video.playlist_id && video.advisor_id) {
                  onNavigateToScene(video.playlist_id, video.advisor_id);
                }
              }}
            >
              🎬 {video.playlist.name}
            </button>
          )}
        </div>
      }
      width="lg"
      onPrev={onPrev}
      onNext={onNext}
      fixedHeight
    >
      {/* === 1. TABS: Generation / Prompt / Answer === */}
      <Tabs defaultValue="generation">
        <TabsList className="w-full h-7">
          <TabsTrigger value="generation" className="text-[10px] px-2">Изображение</TabsTrigger>
          <TabsTrigger value="prompt" className="text-[10px] px-2">Промт</TabsTrigger>
          <TabsTrigger value="answer" className="text-[10px] px-2 flex items-center gap-1"><MessageSquare className="w-3 h-3" />Ответ</TabsTrigger>
        </TabsList>

        <TabsContent value="generation" className="space-y-2 mt-2">
          {/* Pipeline status banner */}
          {(() => {
            const reelBusy = effectiveReelStatus === 'generating';
            const genBusy = effectiveGenerationStatus === 'generating';
            const hasError = (effectiveGenerationStatus === 'error' || effectiveReelStatus === 'error') && !hasGeneratedVideo;
            const genCount = (video as any).generation_count || 0;
            if (genBusy || reelBusy || hasError) {
              return (
                <div className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium",
                  hasError ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                )}>
                  {hasError ? '❌' : <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>
                    {hasError ? (video.error_message ? `Ошибка: ${video.error_message}` : 'Ошибка генерации') :
                     genBusy ? 'Генерация видео HeyGen...' :
                     reelBusy ? 'Постобработка (битрейт/субтитры)...' : ''}
                  </span>
                  {genCount > 0 && <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">#{genCount}</Badge>}
                </div>
              );
            }
            if (genCount > 0) {
              return (
                <div className="flex items-center gap-2 px-2 py-1 rounded-md text-[10px] text-muted-foreground bg-muted/50">
                  <span>Генераций: {genCount}</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Action buttons row */}
          {(() => {
            const atmosBusy = isGeneratingCover || localBusy === 'atmosphere';
            const coverBusy = isGeneratingCover || localBusy === 'cover';
            const videoBusy = effectiveGenerationStatus === 'generating' || effectiveReelStatus === 'generating' || isGenerating || localBusy === 'video';
            const atmosDisabled = atmosBusy;
            const coverDisabled = coverBusy || !atmosphereUrl;
            const videoDisabled = videoBusy;
            return (
              <div className="grid grid-cols-3 gap-2">
                <Button size="xs" variant="outline" className={cn(atmosDisabled ? "border-muted text-muted-foreground" : "border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20")} onClick={() => { setLocalBusy('atmosphere'); onGenerateAtmosphere(video, atmospherePromptText || undefined); }} disabled={atmosDisabled}>
                  {atmosBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 1. ФОН
                </Button>
                <Button size="xs" variant="outline" className={cn(coverDisabled ? "border-muted text-muted-foreground" : "border-orange-500/50 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20")} onClick={() => { setLocalBusy('cover'); onGenerateCover(video); }} disabled={coverDisabled}>
                  {coverBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 2. Обложка
                </Button>
                <Button size="xs" variant="outline" className={cn(videoDisabled ? "border-muted text-muted-foreground" : "border-green-500/50 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20")} onClick={() => { setLocalBusy('video'); onGenerateVideo(video); }} disabled={videoDisabled}>
                  {videoBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 3. Видео
                </Button>
              </div>
            );
          })()}

          {/* 3-column pipeline with status badges */}
          <div className="grid grid-cols-3 gap-2">
            {/* Atmosphere */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Sun className="w-3 h-3" />Фон ({atmosphereVariants.length})</Label>
              {atmosphereVariants.length > 0 ? (
                <div className="relative">
                  <div className="relative aspect-[9/16] rounded-md overflow-hidden border bg-muted group cursor-pointer" onClick={() => window.open(atmosphereVariants[atmosIndex]?.atmosphere_url || '', '_blank')}>
                    <img src={atmosphereVariants[atmosIndex]?.atmosphere_url || ''} alt="Фон" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleSelectVariant(atmosphereVariants[atmosIndex], 'atmosphere'); }}><Check className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteVariant(atmosphereVariants[atmosIndex], 'atmosphere'); }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    {atmosphereVariants[atmosIndex]?.is_active && <div className="absolute top-1 right-1"><Badge className="text-[7px] px-1 py-0 bg-primary">Active</Badge></div>}
                    {atmosphereVariants[atmosIndex]?.created_at && <div className="absolute top-1 left-1 text-[7px] bg-black/60 text-white px-1 rounded">{new Date(atmosphereVariants[atmosIndex].created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                    <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", atmosStatus.colorClass)}>{atmosStatus.label}</div>
                  </div>
                  {atmosphereVariants.length > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={atmosIndex === 0} onClick={() => setAtmosIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                      <span className="text-[8px] text-muted-foreground">{atmosIndex + 1}/{atmosphereVariants.length}</span>
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={atmosIndex === atmosphereVariants.length - 1} onClick={() => setAtmosIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              ) : atmosphereUrl ? (
                <div className="relative aspect-[9/16] rounded-md overflow-hidden border bg-muted group cursor-pointer" onClick={() => window.open(atmosphereUrl, '_blank')}>
                  <img src={atmosphereUrl} alt="Фон" className="w-full h-full object-cover" />
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", atmosStatus.colorClass)}>{atmosStatus.label}</div>
                </div>
              ) : (
                <div className="relative aspect-[9/16] rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                  <Sun className="w-4 h-4 text-muted-foreground/30" /><span className="text-[8px] text-muted-foreground/40">Нет фона</span>
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", atmosStatus.colorClass)}>{atmosStatus.label}</div>
                </div>
              )}
            </div>

            {/* Cover */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" />Обложка ({coverVariants.length})</Label>
              {coverVariants.length > 0 ? (
                <div className="relative">
                  <div className="relative aspect-[9/16] rounded-md overflow-hidden border-2 border-primary bg-muted group cursor-pointer" onClick={() => window.open(coverVariants[coverIndex]?.front_cover_url || '', '_blank')}>
                    <img src={coverVariants[coverIndex]?.front_cover_url || ''} alt="Обложка" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleSelectVariant(coverVariants[coverIndex], 'cover'); }}><Check className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteVariant(coverVariants[coverIndex], 'cover'); }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    {coverVariants[coverIndex]?.is_active && <div className="absolute top-1 right-1"><Badge className="text-[7px] px-1 py-0 bg-primary">Active</Badge></div>}
                    {coverVariants[coverIndex]?.created_at && <div className="absolute top-1 left-1 text-[7px] bg-black/60 text-white px-1 rounded">{new Date(coverVariants[coverIndex].created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                    <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", coverStatus.colorClass)}>{coverStatus.label}</div>
                  </div>
                  {coverVariants.length > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={coverIndex === 0} onClick={() => setCoverIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                      <span className="text-[8px] text-muted-foreground">{coverIndex + 1}/{coverVariants.length}</span>
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={coverIndex === coverVariants.length - 1} onClick={() => setCoverIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              ) : video.front_cover_url ? (
                <div className="relative aspect-[9/16] rounded-md overflow-hidden border-2 border-primary bg-muted group cursor-pointer" onClick={() => window.open(video.front_cover_url!, '_blank')}>
                  <img src={video.front_cover_url} alt="Обложка" className="w-full h-full object-cover" />
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", coverStatus.colorClass)}>{coverStatus.label}</div>
                </div>
              ) : (
                <div className="relative aspect-[9/16] rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                  <ImageIcon className="w-4 h-4 text-muted-foreground/30" /><span className="text-[8px] text-muted-foreground/40">Нет обложки</span>
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", coverStatus.colorClass)}>{coverStatus.label}</div>
                </div>
              )}
            </div>

            {/* Video */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Play className="w-3 h-3" />Видео ({videoVariantsDb.length || videoVariants.length})</Label>
              {videoVariantsDb.length > 0 ? (
                <div className="relative">
                  <div className="relative aspect-[9/16] rounded-md overflow-hidden bg-black">
                    {(() => {
                      const v = videoVariantsDb[vidVariantIndex];
                      const currentUrl = v?.video_path || v?.heygen_video_url || '';
                      const variantLabel = v?.video_path && v.video_path !== v.reduced_video_url && v.video_path !== v.heygen_video_url
                        ? 'С субтитрами'
                        : v?.reduced_video_url && (v.video_path === v.reduced_video_url || (!v.video_path && v.reduced_video_url))
                        ? 'Сжатое видео'
                        : 'HeyGen видео';
                      return (
                        <>
                          <video
                            key={currentUrl}
                            src={currentUrl}
                            controls className="w-full h-full object-contain"
                            poster={video.front_cover_url || undefined}
                            onLoadedMetadata={handleVideoLoadedMetadata}
                          />
                          <span className="absolute top-1 right-1 bg-black/60 text-white text-[7px] px-1 py-0.5 rounded">
                            #{v?.generation_number || '?'}
                          </span>
                          <div className="absolute top-1 left-1 text-[7px] bg-black/60 text-white px-1 rounded">
                            {new Date(v?.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="absolute top-6 left-1 text-[7px] bg-black/60 text-white px-1 rounded">{variantLabel}</div>
                          {v?.is_active && <div className="absolute top-6 right-1"><Badge className="text-[7px] px-1 py-0 bg-primary">Active</Badge></div>}
                        </>
                      );
                    })()}
                    <div className="absolute top-0 left-0 right-0 h-2/3 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleSelectVideoVariant(videoVariantsDb[vidVariantIndex]); }}
                        title="Выбрать этот вариант"
                      ><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleDeleteVideoVariant(videoVariantsDb[vidVariantIndex]); }}
                        title="Удалить вариант"
                      ><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", videoStatus.colorClass)}>{videoStatus.label}</div>
                  </div>
                  {videoVariantsDb.length > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={vidVariantIndex === 0} onClick={() => setVidVariantIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                      <span className="text-[8px] text-muted-foreground">{vidVariantIndex + 1}/{videoVariantsDb.length}</span>
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={vidVariantIndex === videoVariantsDb.length - 1} onClick={() => setVidVariantIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              ) : videoUrl ? (
                <div className="relative">
                  <div className="relative aspect-[9/16] rounded-md overflow-hidden bg-black">
                    <video key={videoUrl} src={videoUrl} controls className="w-full h-full object-contain" poster={video.front_cover_url || undefined} onLoadedMetadata={handleVideoLoadedMetadata} />
                    {currentVideoLabel && <span className="absolute top-1 right-1 bg-black/60 text-white text-[7px] px-1 py-0.5 rounded">{currentVideoLabel}</span>}
                    {video.updated_at && <div className="absolute top-1 left-1 text-[7px] bg-black/60 text-white px-1 rounded">{new Date(video.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                    <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", videoStatus.colorClass)}>{videoStatus.label}</div>
                  </div>
                  {videoVariants.length > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={videoIndex === 0} onClick={() => setVideoIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                      <span className="text-[8px] text-muted-foreground">{videoIndex + 1}/{videoVariants.length}</span>
                      <Button size="icon" variant="ghost" className="h-4 w-4" disabled={videoIndex === videoVariants.length - 1} onClick={() => setVideoIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[9/16] rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                  {effectiveGenerationStatus === 'generating' || effectiveReelStatus === 'generating' ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-[8px] text-muted-foreground">
                        {effectiveGenerationStatus === 'generating' ? 'Генерация...' : 'Постобработка...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Play className="w-4 h-4 text-muted-foreground/40" /></div>
                      <span className="text-[8px] text-muted-foreground/40">Видео не сгенерировано</span>
                    </>
                  )}
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", videoStatus.colorClass)}>{videoStatus.label}</div>
                </div>
              )}
            </div>
          </div>

          {/* Bitrate + Overlay + Subtitle buttons under media grid */}
          {video.heygen_video_url && (
            <>
              <div className="flex gap-2 mt-1">
                <Button
                  size="xs"
                  variant="outline"
                  className="flex-1 text-[10px]"
                  disabled={isProcessLocked}
                  onClick={async () => {
                    const src = video.heygen_video_url;
                    if (!src) return;
                    const ac = new AbortController();
                    setProcessAbort(ac);
                    try {
                      setProcessState({ type: 'bitrate', phase: 'loading', progress: 5 });
                      const { reduceVideoBitrate } = await import('@/lib/videoNormalizer');
                      const resultUrl = await reduceVideoBitrate(src, (pct) => {
                        setProcessState({ type: 'bitrate', phase: 'compressing', progress: Math.min(100, Math.round(5 + pct * 85)) });
                      }, ac.signal);
                      onUpdateVideo(video.id, { reduced_video_url: resultUrl, video_path: resultUrl } as any);
                      toast.success('Битрейт уменьшен');
                    } catch (err) {
                      if (ac.signal.aborted) { toast.info('Операция отменена'); }
                      else { console.error('Bitrate reduction error:', err); toast.error('Ошибка сжатия видео'); }
                    } finally {
                      setProcessState(null);
                      setProcessAbort(null);
                    }
                  }}
                >
                  <Minimize2 className="w-3 h-3 mr-1" />Битрейт
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="flex-1 text-[10px]"
                  disabled={isProcessLocked || !video.heygen_video_url || !(video as any).background_video_url}
                  title={!(video as any).background_video_url ? 'Нет назначенной подложки' : 'Наложить аватар на фон'}
                  onClick={async () => {
                    const avatarUrl = video.heygen_video_url;
                    const bgUrl = (video as any).background_video_url;
                    if (!avatarUrl || !bgUrl) { toast.error('Нет видео или подложки'); return; }
                    const ac = new AbortController();
                    setProcessAbort(ac);
                    try {
                      const existingVariant = await (supabase.from('video_variants' as any) as any)
                        .select('id').eq('video_id', video.id).eq('heygen_video_url', video.heygen_video_url).limit(1);
                      if (!existingVariant.data?.length) {
                        await (supabase.from('video_variants' as any) as any).insert({
                          video_id: video.id,
                          heygen_video_id: video.heygen_video_id,
                          heygen_video_url: video.heygen_video_url,
                          reduced_video_url: video.reduced_video_url,
                          video_path: video.video_path,
                          is_active: false,
                          generation_number: (video as any).generation_count || 1,
                        });
                      }
                      const { overlayAvatarOnBackground } = await import('@/lib/videoOverlay');
                      setProcessState({ type: 'overlay', phase: 'compositing', progress: 3 });
                      const resultUrl = await overlayAvatarOnBackground(
                        avatarUrl, bgUrl,
                        (info) => setProcessState({ type: 'overlay', phase: info.phase, progress: Math.min(100, info.progress) }),
                        ac.signal,
                      );
                      await onUpdateVideo(video.id, { reduced_video_url: resultUrl, video_path: resultUrl, reel_status: 'ready' } as any);
                      // Insert overlay as a new variant
                      await (supabase.from('video_variants' as any) as any).insert({
                        video_id: video.id,
                        heygen_video_id: video.heygen_video_id,
                        heygen_video_url: video.heygen_video_url,
                        reduced_video_url: resultUrl,
                        video_path: resultUrl,
                        is_active: true,
                        generation_number: (video as any).generation_count || 1,
                      });
                      fetchVariants();
                      toast.success('Фон наложен');
                    } catch (err) {
                      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
                        toast.info('Операция отменена');
                      } else {
                        console.error('Overlay error:', err);
                        toast.error('Ошибка наложения фона');
                      }
                    } finally {
                      setProcessState(null);
                      setProcessAbort(null);
                    }
                  }}
                >
                  <MonitorPlay className="w-3 h-3 mr-1" />Фон
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="flex-1 text-[10px]"
                  disabled={isProcessLocked || !video.word_timestamps}
                  onClick={async () => {
                    const cleanSrc = (video as any).reduced_video_url || video.heygen_video_url;
                    if (!cleanSrc) { toast.error('Нет исходного видео'); return; }
                    const ac = new AbortController();
                    setProcessAbort(ac);
                    try {
                      const { burnSubtitlesBrowser } = await import('@/lib/videoSubtitles');
                      setProcessState({ type: 'subtitles', phase: 'burning_subtitles', progress: 3 });
                      const watchdog = setTimeout(() => ac.abort(), 15 * 60 * 1000);
                      const resultUrl = await burnSubtitlesBrowser(
                        cleanSrc,
                        video.word_timestamps as any,
                        { fontSize: 56 },
                        (info) => setProcessState({ type: 'subtitles', phase: info.phase, progress: Math.min(100, info.progress) }),
                        ac.signal,
                        highlightMode,
                      );
                      clearTimeout(watchdog);
                      onUpdateVideo(video.id, { video_path: resultUrl } as any);
                      toast.success('Субтитры вшиты');
                    } catch (err) {
                      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
                        toast.info('Операция отменена');
                      } else {
                        console.error('Subtitle error:', err);
                        toast.error('Ошибка вшивки субтитров');
                      }
                    } finally {
                      setProcessState(null);
                      setProcessAbort(null);
                    }
                  }}
                >
                  <Subtitles className="w-3 h-3 mr-1" />Субтитры
                </Button>
              </div>
              {/* Unified progress bar */}
              {(processState || (autoSubtitleProgress && !processState)) && (() => {
                const active = processState || (autoSubtitleProgress ? { type: 'subtitles' as const, phase: autoSubtitleProgress.phase, progress: autoSubtitleProgress.progress } : null);
                if (!active) return null;
                const typeLabel = active.type === 'bitrate' ? 'Битрейт' : active.type === 'overlay' ? 'Фон' : 'Субтитры';
                const pct = Math.min(100, active.progress);
                return (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">{typeLabel} {pct}%</span>
                    <Button
                      size="xs"
                      variant="destructive"
                      className="text-[10px] px-2 h-5 shrink-0"
                      onClick={() => {
                        if (processState) {
                          processAbort?.abort();
                          setProcessState(null);
                          setProcessAbort(null);
                        } else if (autoSubtitleProgress) {
                          onCancelAutoProcess?.();
                        }
                        toast.info('Процесс остановлен');
                      }}
                    >
                      <Square className="w-3 h-3 mr-1" />Стоп
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="prompt" className="space-y-2 mt-2">
          <Textarea value={atmospherePromptText} onChange={(e) => setAtmospherePromptText(e.target.value)} placeholder="Промт для генерации атмосферы..." className="min-h-[180px] text-xs font-mono" rows={8} />
          <p className="text-[10px] text-muted-foreground">Отредактируйте промт перед генерацией. Промт подтянут из настроек.</p>
        </TabsContent>

        <TabsContent value="answer" className="space-y-2 mt-2">
          <label className="text-xs font-medium">Ответ духовника</label>
          <Textarea value={advisorAnswer} onChange={(e) => setAdvisorAnswer(e.target.value)} onBlur={handleAdvisorAnswerSave} placeholder="Введите ответ духовника..." className="min-h-[180px] text-xs" />
          <p className="text-[10px] text-muted-foreground">Текст сохраняется автоматически при потере фокуса.</p>
        </TabsContent>
      </Tabs>

      <Separator />


      {/* === 2. Publication channels + Readiness === */}
      <PanelSection title="Каналы публикации">
        <div className="flex flex-wrap gap-1.5">
          {publishingChannels.filter((c) => c.is_active).map((channel) => {
            const isSelected = selectedChannels.includes(channel.id);
            return (
              <Badge key={channel.id} variant={isSelected ? "default" : "outline"}
                className={cn("cursor-pointer transition-colors px-2 py-1 text-[10px]", isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted")}
                onClick={() => handleChannelToggle(channel.id)}>
                {channel.name}
              </Badge>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            id="is-ready"
            checked={isReady}
            onCheckedChange={(checked) => {
              const val = !!checked;
              setIsReady(val);
              onUpdateVideo(video.id, { is_ready: val } as any);
            }}
          />
          <Label htmlFor="is-ready" className="text-xs cursor-pointer">Проверено</Label>
        </div>
      </PanelSection>

      {/* === 3. Publish button === */}
      <Button
        className="w-full"
        size="sm"
        onClick={handlePublish}
        disabled={!isReady || selectedChannels.length === 0}
        title={!isReady ? 'Поставьте галочку «Проверено»' : selectedChannels.length === 0 ? 'Выберите каналы' : undefined}
      >
        Отправить на подготовку к публикации ({selectedChannels.length})
      </Button>

      <Separator />

      {/* === 4. Voiceover === */}
      <PanelSection
        title="Озвучка"
        icon={<Volume2 className="w-3.5 h-3.5" />}
        action={
          <Button size="xs" variant="secondary" onClick={() => onGenerateVoiceover?.(video)} disabled={video.voiceover_status === 'generating' || !video.advisor_answer}>
            {video.voiceover_status === 'generating' ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Генерация...</> : video.voiceover_url ? 'Перегенерировать' : 'Сгенерировать'}
          </Button>
        }
      >
        {video.voiceover_url && <audio controls className="w-full h-7" src={video.voiceover_url}>Your browser does not support the audio element.</audio>}
        {!video.voiceover_url && video.voiceover_status !== 'generating' && (
          <div className="py-3 rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
            <Volume2 className="w-4 h-4 text-muted-foreground/30" />
            <span className="text-[9px] text-muted-foreground/40">Озвучка не сгенерирована</span>
          </div>
        )}

        {/* === 5. Subtitles options === */}
        {video.word_timestamps && (video.reduced_video_url || video.heygen_video_url) && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="highlight-mode"
              checked={highlightMode}
              onCheckedChange={(checked) => setHighlightMode(!!checked)}
              disabled={processState?.type === 'subtitles'}
            />
            <Label htmlFor="highlight-mode" className="text-[10px] cursor-pointer">Highlight (караоке)</Label>
          </div>
        )}
      </PanelSection>

      <Separator />

      {/* === 6. Links section === */}
      <div className="space-y-1.5 text-[11px]">
        <h4 className="font-medium text-xs">Ссылки</h4>
        <div className="max-h-[120px] overflow-y-auto space-y-1">
          {[
            { label: 'Аудио', url: video.voiceover_url },
            { label: 'Обложка', url: video.front_cover_url },
            { label: 'HeyGen видео', url: video.heygen_video_url },
            { label: 'Финальное видео', url: video.video_path },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">{label}</span>
              {url ? (
                <div className="flex items-center gap-1">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 shrink-0" />Открыть
                  </a>
                  <button
                    className="p-0.5 hover:bg-muted rounded"
                    onClick={() => { navigator.clipboard.writeText(url); toast.success('Ссылка скопирована'); }}
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* === 7. Meta === */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] items-center">
        <span className="text-muted-foreground">Длительность видео</span>
        <span>{durationFormatted}</span>
        <span className="text-muted-foreground">Размер видео</span>
        <span>
          {originalSizeBytes && videoSizeBytes && originalSizeBytes > videoSizeBytes
            ? `${formatFileSize(originalSizeBytes)} → ${sizeFormatted} (×${(originalSizeBytes / videoSizeBytes).toFixed(1)})`
            : sizeFormatted}
        </span>
      </div>
    </UnifiedPanel>
  );
}
