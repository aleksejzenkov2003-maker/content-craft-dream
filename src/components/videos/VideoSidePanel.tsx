import { useState, useEffect, useCallback } from 'react';
import { UnifiedPanel, PanelField, PanelSection } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  Loader2, ChevronLeft, ChevronRight, Link as LinkIcon,
  Image as ImageIcon, Play, Check, Trash2, Copy,
  Sun, Layers, Volume2, MessageSquare, Subtitles, X, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CoverVariant {
  id: string;
  atmosphere_url: string | null;
  front_cover_url: string | null;
  prompt: string | null;
  variant_type: string | null;
  is_active: boolean | null;
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
}: VideoSidePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [atmosphereVariants, setAtmosphereVariants] = useState<CoverVariant[]>([]);
  const [coverVariants, setCoverVariants] = useState<CoverVariant[]>([]);
  const [atmosIndex, setAtmosIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [atmospherePromptText, setAtmospherePromptText] = useState('');
  const [subtitleProgress, setSubtitleProgress] = useState<{ phase: string; progress: number } | null>(null);
  const [subtitleAbort, setSubtitleAbort] = useState<AbortController | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [videoSizeBytes, setVideoSizeBytes] = useState<number | null>(null);

  const advisor = advisors.find((a) => a.id === video?.advisor_id);
  const advisorName = advisor?.display_name || advisor?.name || 'Духовник';

  const fetchVariants = useCallback(async () => {
    if (!video?.id) return;
    const { data } = await supabase.from('cover_thumbnails').select('*').eq('video_id', video.id).order('created_at', { ascending: false });
    if (data) {
      const atmos = data.filter((d: any) => d.variant_type === 'atmosphere');
      const covers = data.filter((d: any) => d.variant_type === 'cover' || !d.variant_type);
      setAtmosphereVariants(atmos as CoverVariant[]);
      setCoverVariants(covers as CoverVariant[]);
      setAtmosIndex(atmos.findIndex((a: any) => a.is_active) >= 0 ? atmos.findIndex((a: any) => a.is_active) : 0);
      setCoverIndex(covers.findIndex((c: any) => c.is_active) >= 0 ? covers.findIndex((c: any) => c.is_active) : 0);
    }
  }, [video?.id]);

  useEffect(() => {
    if (open && video?.word_timestamps) {
      import('@/lib/ffmpegLoader').then(({ preloadFFmpeg }) => preloadFFmpeg()).catch(() => {});
    }
  }, [open, !!video?.word_timestamps]);

  useEffect(() => { fetchVariants(); }, [fetchVariants, (video as any)?.atmosphere_url, video?.front_cover_url]);

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

  if (!video) return null;

  const handleChannelToggle = (channelId: string) => {
    if (!video) return;
    const newChannels = selectedChannels.includes(channelId) ? selectedChannels.filter((id) => id !== channelId) : [...selectedChannels, channelId];
    setSelectedChannels(newChannels);
    onUpdateVideo(video.id, { selected_channels: newChannels } as any);
  };
  const handlePublish = () => { if (video && selectedChannels.length > 0) onPublish(video, selectedChannels); };
  const handleAdvisorAnswerSave = () => {
    if (!video) return;
    onUpdateVideo(video.id, { advisor_answer: advisorAnswer } as any);
  };

  const handleSelectVariant = async (variant: CoverVariant, type: 'atmosphere' | 'cover') => {
    if (!video) return;
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
    if (!video) return;
    try {
      await supabase.from('cover_thumbnails').delete().eq('id', variant.id);
      fetchVariants();
      toast.success('Вариант удалён');
    } catch (e) { toast.error('Ошибка удаления'); }
  };

  const atmosphereUrl = (video as any)?.atmosphere_url;
  const normalizedCoverStatus = video?.cover_status === 'generating' && !!video?.front_cover_url ? 'ready' : video?.cover_status || 'pending';
  const isGeneratingCover = normalizedCoverStatus === 'generating';

  const atmosStatus = resolveAssetStatus(atmosphereUrl, video?.cover_status);
  const coverStatus = resolveAssetStatus(video?.front_cover_url, video?.cover_status);
  const videoStatus = resolveAssetStatus(video?.video_path || video?.heygen_video_url, video?.generation_status);

  const videoUrl = video?.video_path || video?.heygen_video_url || null;
  const effectiveDuration = video?.video_duration || detectedDuration;
  const durationFormatted = effectiveDuration ? `${Math.floor(effectiveDuration / 60)}:${String(Math.round(effectiveDuration % 60)).padStart(2, '0')}` : '—';
  const sizeFormatted = videoSizeBytes ? `${(videoSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '—';

  useEffect(() => {
    if (!videoUrl) {
      setVideoSizeBytes(null);
      return;
    }

    let cancelled = false;

    const resolveVideoSize = async () => {
      try {
        let response = await fetch(videoUrl, { method: 'HEAD' });
        let contentLength = response.headers.get('content-length');

        if (!contentLength) {
          response = await fetch(videoUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          const contentRange = response.headers.get('content-range');
          const totalFromRange = contentRange?.split('/')[1];
          contentLength = totalFromRange || response.headers.get('content-length');
        }

        if (!cancelled && contentLength) {
          setVideoSizeBytes(Number(contentLength));
        } else if (!cancelled) {
          setVideoSizeBytes(null);
        }
      } catch {
        if (!cancelled) {
          setVideoSizeBytes(null);
        }
      }
    };

    resolveVideoSize();

    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!video) return;

    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur)) {
      const roundedDuration = Math.round(dur);
      setDetectedDuration(roundedDuration);
      if (!video.video_duration) {
        supabase.from('videos').update({ video_duration: roundedDuration }).eq('id', video.id).then();
      }
    }
  };

  if (!video) return null;
    <UnifiedPanel
      open={open}
      onOpenChange={onOpenChange}
      title={`#${video.video_number || '—'} ${video.question || ''} — ${advisorName}`}
      width="lg"
      onPrev={onPrev}
      onNext={onNext}
      fixedHeight
    >
      {/* === 1. TABS: Generation / Prompt / Answer === */}
      <Tabs defaultValue="generation">
        <TabsList className="grid w-full grid-cols-3 h-7">
          <TabsTrigger value="generation" className="text-[11px]">Генерация изображения</TabsTrigger>
          <TabsTrigger value="prompt" className="text-[11px]">Промт</TabsTrigger>
          <TabsTrigger value="answer" className="text-[11px] flex items-center gap-1"><MessageSquare className="w-3 h-3" />Ответ духовника</TabsTrigger>
        </TabsList>

        <TabsContent value="generation" className="space-y-2 mt-2">
          {/* Action buttons row */}
          <div className="grid grid-cols-3 gap-2">
             <Button size="xs" variant="outline" className="border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20" onClick={() => onGenerateAtmosphere(video, atmospherePromptText || undefined)} disabled={isGeneratingCover}>
                {isGeneratingCover ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 1. ФОН
              </Button>
              <Button size="xs" variant="outline" className="border-orange-500/50 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20" onClick={() => onGenerateCover(video)} disabled={isGeneratingCover || !atmosphereUrl}>
                {isGeneratingCover ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 2. Обложка
              </Button>
              <Button size="xs" variant="outline" className="border-green-500/50 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20" onClick={() => onGenerateVideo(video)} disabled={video.generation_status === 'generating' || isGenerating || !video.voiceover_url} title={!video.voiceover_url ? 'Сначала создайте озвучку' : undefined}>
                {video.generation_status === 'generating' || isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Шаг 3. Видео
              </Button>
          </div>

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
                    {/* Status badge */}
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
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Play className="w-3 h-3" />Видео</Label>
              {videoUrl ? (
                <div className="relative aspect-[9/16] rounded-md overflow-hidden bg-black">
                  <video src={videoUrl} controls className="w-full h-full object-contain" poster={video.front_cover_url || undefined} onLoadedMetadata={handleVideoLoadedMetadata} />
                  {video.video_path && <span className="absolute top-1 right-1 bg-black/60 text-white text-[7px] px-1 py-0.5 rounded">С субтитрами</span>}
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", videoStatus.colorClass)}>{videoStatus.label}</div>
                </div>
              ) : (
                <div className="relative aspect-[9/16] rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Play className="w-4 h-4 text-muted-foreground/40" /></div>
                  <span className="text-[8px] text-muted-foreground/40">Видео не сгенерировано</span>
                  <div className={cn("absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium py-0.5 rounded", videoStatus.colorClass)}>{videoStatus.label}</div>
                </div>
              )}
            </div>
          </div>
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
          <Label htmlFor="is-ready" className="text-xs cursor-pointer">Готовность</Label>
        </div>
      </PanelSection>

      {/* === 3. Publish button === */}
      <Button
        className="w-full"
        size="sm"
        onClick={handlePublish}
        disabled={!isReady || selectedChannels.length === 0}
        title={!isReady ? 'Поставьте галочку «Готовность»' : selectedChannels.length === 0 ? 'Выберите каналы' : undefined}
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

        {/* === 5. Subtitles === */}
        {/* Auto-processing progress (from postProcessVideo) */}
        {autoSubtitleProgress && !subtitleProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-[10px] font-medium">
                {autoSubtitleProgress.phase === 'reducing_bitrate' ? 'Уменьшение битрейта...' :
                 autoSubtitleProgress.phase === 'loading_ffmpeg' ? 'Загрузка FFmpeg...' :
                 autoSubtitleProgress.phase === 'downloading_video' ? 'Скачивание видео...' :
                 autoSubtitleProgress.phase === 'burning_subtitles' ? 'Вшивка субтитров...' :
                 autoSubtitleProgress.phase === 'uploading_result' ? 'Загрузка результата...' :
                 autoSubtitleProgress.phase === 'done' ? 'Готово!' :
                 'Постобработка...'}
              </span>
              <span className="text-[9px] text-muted-foreground ml-auto">{autoSubtitleProgress.progress}%</span>
            </div>
            <Progress value={autoSubtitleProgress.progress} className="h-1" />
          </div>
        )}
        {video.word_timestamps && (video.heygen_video_url || video.video_path) && !autoSubtitleProgress && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                className="flex-1"
                disabled={subtitleProgress !== null}
                onClick={async () => {
                  const ac = new AbortController();
                  setSubtitleAbort(ac);
                  try {
                    const { burnSubtitlesHybrid, burnSubtitlesBrowser } = await import('@/lib/videoSubtitles');
                    const { isBrowserFFmpegSupported: checkSupport } = await import('@/lib/ffmpegLoader');
                    const watchdog = setTimeout(() => ac.abort(), 8 * 60 * 1000);
                    try {
                      const result = await burnSubtitlesHybrid(
                        video.id,
                        (info) => setSubtitleProgress({ phase: info.phase, progress: info.progress }),
                        ac.signal,
                      );
                      clearTimeout(watchdog);
                      onUpdateVideo(video.id, { video_path: result.videoUrl } as any);
                      toast.success('Субтитры вшиты');
                      return;
                    } catch (hybridErr) {
                      clearTimeout(watchdog);
                      if (ac.signal.aborted) throw hybridErr;
                      console.warn('[subtitles] Hybrid failed, trying pure browser:', hybridErr);
                    }
                    if (checkSupport()) {
                      const srcUrl = video.heygen_video_url || video.video_path;
                      if (!srcUrl) throw new Error('No video URL');
                      setSubtitleProgress({ phase: 'loading_ffmpeg', progress: 3 });
                      const watchdog2 = setTimeout(() => ac.abort(), 8 * 60 * 1000);
                      const file = await burnSubtitlesBrowser(
                        srcUrl,
                        video.word_timestamps as any,
                        { fontSize: 48 },
                        (info) => setSubtitleProgress({ phase: info.phase, progress: info.progress }),
                        ac.signal,
                      );
                      clearTimeout(watchdog2);
                      setSubtitleProgress({ phase: 'uploading_result', progress: 95 });
                      const fileName = `videos/${video.id}_subtitled_${Date.now()}.mp4`;
                      const { error: uploadError } = await supabase.storage
                        .from('media-files')
                        .upload(fileName, file, { contentType: 'video/mp4', upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
                      onUpdateVideo(video.id, { video_path: urlData.publicUrl } as any);
                      toast.success('Субтитры добавлены');
                      return;
                    }
                    throw new Error('FFmpeg unavailable');
                  } catch (err) {
                    if ((err as Error)?.name === 'AbortError') {
                      toast.info('Операция отменена');
                    } else {
                      console.error('Subtitle error:', err);
                      toast.error('Не удалось вшить субтитры. Скачиваем SRT…');
                      try {
                        const { downloadSubtitleFile } = await import('@/lib/videoSubtitles');
                        downloadSubtitleFile(video.word_timestamps as any, 'srt');
                      } catch (_) {}
                    }
                  } finally {
                    setSubtitleProgress(null);
                    setSubtitleAbort(null);
                  }
                }}
              >
                {subtitleProgress !== null ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{
                    subtitleProgress.phase === 'server_processing' ? 'Обработка на сервере' :
                    subtitleProgress.phase === 'loading_ffmpeg' ? 'Загрузка FFmpeg' :
                    subtitleProgress.phase === 'downloading_video' ? 'Скачивание видео' :
                    subtitleProgress.phase === 'burning_subtitles' ? 'Вшивка субтитров' :
                    'Загрузка результата'
                  } {subtitleProgress.progress}%</>
                ) : (
                  <><Subtitles className="w-3 h-3 mr-1" />Вшить субтитры</>
                )}
              </Button>
              {subtitleProgress !== null && subtitleAbort && (
                <Button size="xs" variant="ghost" className="w-7 p-0 text-destructive hover:text-destructive" onClick={() => subtitleAbort.abort()} title="Отменить">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {subtitleProgress !== null && (
              <div className="space-y-0.5">
                <Progress value={subtitleProgress.progress} className="h-1" />
                <p className="text-[9px] text-muted-foreground">
                  {subtitleProgress.phase === 'server_processing' && 'Отправка на серверную обработку…'}
                  {subtitleProgress.phase === 'loading_ffmpeg' && 'Загрузка FFmpeg в браузере…'}
                  {subtitleProgress.phase === 'downloading_video' && 'Скачивание исходного видео…'}
                  {subtitleProgress.phase === 'burning_subtitles' && 'Вшивка субтитров в видео…'}
                  {subtitleProgress.phase === 'uploading_result' && 'Загрузка результата в хранилище…'}
                </p>
              </div>
            )}
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
            { label: 'HeyGen', url: video.heygen_video_url },
            { label: 'Финальное', url: video.video_path },
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
        <span>{sizeFormatted}</span>
      </div>
    </UnifiedPanel>
  );
}
