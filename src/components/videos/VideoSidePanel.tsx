import { useState, useEffect, useCallback } from 'react';
import { UnifiedPanel, PanelField, PanelSection } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { PublishingChannel } from '@/hooks/usePublishingChannels';
import {
  Loader2, ChevronLeft, ChevronRight, Link as LinkIcon,
  Image as ImageIcon, Play, Check, Trash2, CalendarIcon,
  Sun, Layers, Volume2, MessageSquare, Subtitles,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
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
}

const coverStatusOptions = [
  { value: 'pending', label: 'Ожидает', color: 'text-muted-foreground' },
  { value: 'generating', label: 'Генерация', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'atmosphere_ready', label: 'Атмосфера готова', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'ready', label: 'Готово', color: 'text-green-600 dark:text-green-400' },
  { value: 'error', label: 'Ошибка', color: 'text-destructive' },
];

const videoStatusOptions = [
  { value: 'pending', label: 'Ожидает', color: 'text-muted-foreground' },
  { value: 'generating', label: 'Генерация', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'ready', label: 'Готово', color: 'text-green-600 dark:text-green-400' },
  { value: 'published', label: 'Опубликован', color: 'text-primary' },
  { value: 'error', label: 'Ошибка', color: 'text-destructive' },
];

const voiceoverStatusOptions = [
  { value: 'pending', label: 'Ожидает', color: 'text-muted-foreground' },
  { value: 'generating', label: 'Генерация', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'ready', label: 'Готово', color: 'text-green-600 dark:text-green-400' },
  { value: 'error', label: 'Ошибка', color: 'text-destructive' },
];

export function VideoSidePanel({
  video, open, onOpenChange, advisors, publishingChannels,
  onGenerateAtmosphere, onGenerateCover, onGenerateVideo, onGenerateVoiceover,
  onUpdateVideo, onPublish, isGenerating, onPrev, onNext,
}: VideoSidePanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [pubDateOpen, setPubDateOpen] = useState(false);
  const [atmosphereVariants, setAtmosphereVariants] = useState<CoverVariant[]>([]);
  const [coverVariants, setCoverVariants] = useState<CoverVariant[]>([]);
  const [atmosIndex, setAtmosIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [atmospherePromptText, setAtmospherePromptText] = useState('');
  const [subtitleProgress, setSubtitleProgress] = useState<number | null>(null);

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

  const handleCoverStatusChange = (value: string) => onUpdateVideo(video.id, { cover_status: value });
  const handleVideoStatusChange = (value: string) => onUpdateVideo(video.id, { generation_status: value });
  const handleChannelToggle = (channelId: string) => {
    const newChannels = selectedChannels.includes(channelId) ? selectedChannels.filter((id) => id !== channelId) : [...selectedChannels, channelId];
    setSelectedChannels(newChannels);
    onUpdateVideo(video.id, { selected_channels: newChannels } as any);
  };
  const handlePublish = () => { if (selectedChannels.length > 0) onPublish(video, selectedChannels); };
  const handleAdvisorAnswerSave = () => onUpdateVideo(video.id, { advisor_answer: advisorAnswer } as any);
  const handleDateChange = (date: Date | undefined) => { if (date) onUpdateVideo(video.id, { publication_date: date.toISOString() }); setPubDateOpen(false); };

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

  const pubDate = video.publication_date ? new Date(video.publication_date) : undefined;
  const atmosphereUrl = (video as any).atmosphere_url;
  const normalizedCoverStatus = video.cover_status === 'generating' && !!video.front_cover_url ? 'ready' : video.cover_status || 'pending';
  const isGeneratingCover = normalizedCoverStatus === 'generating';

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={onOpenChange}
      title={`${video.question} — ${advisorName}`}
      width="xl"
      onPrev={onPrev}
      onNext={onNext}
      headerActions={
        <button className="p-1 hover:bg-muted rounded">
          <LinkIcon className="w-4 h-4" />
        </button>
      }
    >
      {/* Publication channels */}
      <PanelSection title="Каналы публикации">
        <div className="flex flex-wrap gap-2">
          {publishingChannels.filter((c) => c.is_active).map((channel) => {
            const isSelected = selectedChannels.includes(channel.id);
            return (
              <Badge key={channel.id} variant={isSelected ? "default" : "outline"}
                className={cn("cursor-pointer transition-colors px-3 py-1.5", isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted")}
                onClick={() => handleChannelToggle(channel.id)}>
                {channel.name}
              </Badge>
            );
          })}
        </div>
        {selectedChannels.length > 0 && <Button className="w-full mt-4" size="sm" onClick={handlePublish}>Публикация ({selectedChannels.length})</Button>}
      </PanelSection>

      <Separator />

      {/* Publication date */}
      <PanelField label="Плановая публикация">
        <Popover open={pubDateOpen} onOpenChange={setPubDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left text-sm", !pubDate && "text-muted-foreground")}>
              <CalendarIcon className="w-3 h-3 mr-2" />
              {pubDate ? format(pubDate, 'dd.MM.yyyy HH:mm', { locale: ru }) : 'Выбрать дату'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={pubDate} onSelect={handleDateChange} locale={ru} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </PanelField>

      <Separator />

      {/* Voiceover */}
      <PanelSection
        title="Озвучка"
        icon={<Volume2 className="w-4 h-4" />}
        action={
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onGenerateVoiceover?.(video)} disabled={video.voiceover_status === 'generating' || !video.advisor_answer}>
            {video.voiceover_status === 'generating' ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Генерация...</> : video.voiceover_url ? 'Перегенерировать' : 'Сгенерировать'}
          </Button>
        }
      >
        {video.voiceover_url && <audio controls className="w-full h-8" src={video.voiceover_url}>Your browser does not support the audio element.</audio>}
        {!video.voiceover_url && video.voiceover_status !== 'generating' && (
          <div className="py-4 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
            <Volume2 className="w-5 h-5 text-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground/40">Озвучка не сгенерирована</span>
          </div>
        )}
        <PanelField label="Статус" labelWidth="100px">
          <Select value={video.voiceover_status || 'pending'} onValueChange={(value) => onUpdateVideo(video.id, { voiceover_status: value } as any)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {voiceoverStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}><span className={o.color}>{o.label}</span></SelectItem>)}
            </SelectContent>
          </Select>
        </PanelField>
        {/* Subtitles */}
        {video.word_timestamps && (
          <div className="space-y-2">
            {(video.heygen_video_url || video.video_path) ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                disabled={subtitleProgress !== null}
                onClick={async () => {
                  try {
                    const { burnSubtitles } = await import('@/lib/videoSubtitles');
                    const timestamps = video.word_timestamps;
                    const videoUrl = video.heygen_video_url || video.video_path;
                    if (!videoUrl) throw new Error('No video URL');
                    setSubtitleProgress(0);
                    const file = await burnSubtitles(
                      videoUrl,
                      timestamps,
                      { wordsPerBlock: 5, fontSize: 48 },
                      (p) => setSubtitleProgress(p)
                    );
                    const fileName = `videos/${video.id}_subtitled_${Date.now()}.mp4`;
                    const { error: uploadError } = await supabase.storage
                      .from('media-files')
                      .upload(fileName, file, { contentType: 'video/mp4', upsert: true });
                    if (uploadError) throw uploadError;
                    const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
                    onUpdateVideo(video.id, { video_path: urlData.publicUrl } as any);
                    toast.success('Субтитры добавлены');
                  } catch (err) {
                    console.error('Subtitle error:', err);
                    toast.error('Ошибка добавления субтитров');
                  } finally {
                    setSubtitleProgress(null);
                  }
                }}
              >
                {subtitleProgress !== null ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Субтитры {subtitleProgress}%</>
                ) : (
                  <><Subtitles className="w-3 h-3 mr-1" />Вшить субтитры в видео</>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={async () => {
                  const { generateSrt } = await import('@/lib/srtGenerator');
                  const srt = generateSrt(video.word_timestamps, 5);
                  const blob = new Blob([srt], { type: 'text/srt' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${video.video_number || video.id}.srt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('SRT файл скачан');
                }}
              >
                <Subtitles className="w-3 h-3 mr-1" />Скачать SRT (видео ещё нет)
              </Button>
            )}
            {subtitleProgress !== null && <Progress value={subtitleProgress} className="h-1.5" />}
          </div>
        )}
      </PanelSection>

      <Separator />

      {/* Generation tabs */}
      <PanelSection title="Генерации обложки и видео">
        <Tabs defaultValue="generation">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="generation" className="text-xs">Генерация изображения</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Промт</TabsTrigger>
            <TabsTrigger value="answer" className="text-xs flex items-center gap-1"><MessageSquare className="w-3 h-3" />Ответ духовника</TabsTrigger>
          </TabsList>

          <TabsContent value="generation" className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20" onClick={() => onGenerateAtmosphere(video, atmospherePromptText || undefined)} disabled={isGeneratingCover}>
                {isGeneratingCover ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sun className="w-3 h-3 mr-1" />}Шаг 1: Фон
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-orange-500/50 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20" onClick={() => onGenerateCover(video)} disabled={isGeneratingCover || !atmosphereUrl}>
                {isGeneratingCover ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Layers className="w-3 h-3 mr-1" />}Шаг 2: Обложка
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-green-500/50 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20" onClick={() => onGenerateVideo(video)} disabled={video.generation_status === 'generating' || isGenerating || !video.voiceover_url} title={!video.voiceover_url ? 'Сначала создайте озвучку' : undefined}>
                {video.generation_status === 'generating' || isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}Шаг 3: Видео
              </Button>
            </div>

            {/* 3-column pipeline */}
            <div className="grid grid-cols-3 gap-3">
              {/* Atmosphere */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Sun className="w-3 h-3" />Фон ({atmosphereVariants.length})</Label>
                {atmosphereVariants.length > 0 ? (
                  <div className="relative">
                    <div className="relative aspect-[9/16] rounded-lg overflow-hidden border bg-muted group cursor-pointer" onClick={() => window.open(atmosphereVariants[atmosIndex]?.atmosphere_url || '', '_blank')}>
                      <img src={atmosphereVariants[atmosIndex]?.atmosphere_url || ''} alt="Atmosphere" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleSelectVariant(atmosphereVariants[atmosIndex], 'atmosphere'); }}><Check className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteVariant(atmosphereVariants[atmosIndex], 'atmosphere'); }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      {atmosphereVariants[atmosIndex]?.is_active && <div className="absolute top-1 right-1"><Badge className="text-[8px] px-1 py-0 bg-primary">Active</Badge></div>}
                    </div>
                    {atmosphereVariants.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={atmosIndex === 0} onClick={() => setAtmosIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                        <span className="text-[9px] text-muted-foreground">{atmosIndex + 1}/{atmosphereVariants.length}</span>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={atmosIndex === atmosphereVariants.length - 1} onClick={() => setAtmosIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                      </div>
                    )}
                    {atmosphereVariants[atmosIndex]?.prompt && <p className="text-[9px] text-muted-foreground/60 italic line-clamp-2">{atmosphereVariants[atmosIndex].prompt}</p>}
                  </div>
                ) : atmosphereUrl ? (
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden border bg-muted group cursor-pointer" onClick={() => window.open(atmosphereUrl, '_blank')}>
                    <img src={atmosphereUrl} alt="Atmosphere" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                    <Sun className="w-5 h-5 text-muted-foreground/30" /><span className="text-[9px] text-muted-foreground/40">Нет фона</span>
                  </div>
                )}
              </div>

              {/* Cover */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" />Обложка ({coverVariants.length})</Label>
                {coverVariants.length > 0 ? (
                  <div className="relative">
                    <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-primary bg-muted group cursor-pointer" onClick={() => window.open(coverVariants[coverIndex]?.front_cover_url || '', '_blank')}>
                      <img src={coverVariants[coverIndex]?.front_cover_url || ''} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleSelectVariant(coverVariants[coverIndex], 'cover'); }}><Check className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDeleteVariant(coverVariants[coverIndex], 'cover'); }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      {coverVariants[coverIndex]?.is_active && <div className="absolute top-1 right-1"><Badge className="text-[8px] px-1 py-0 bg-primary">Active</Badge></div>}
                    </div>
                    {coverVariants.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={coverIndex === 0} onClick={() => setCoverIndex(i => i - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                        <span className="text-[9px] text-muted-foreground">{coverIndex + 1}/{coverVariants.length}</span>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={coverIndex === coverVariants.length - 1} onClick={() => setCoverIndex(i => i + 1)}><ChevronRight className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </div>
                ) : video.front_cover_url ? (
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-primary bg-muted group cursor-pointer" onClick={() => window.open(video.front_cover_url!, '_blank')}>
                    <img src={video.front_cover_url} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1"><Badge className="text-[8px] px-1 py-0 bg-primary">Active</Badge></div>
                  </div>
                ) : (
                  <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/30" /><span className="text-[9px] text-muted-foreground/40">Нет обложки</span>
                  </div>
                )}
              </div>

              {/* Video */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Play className="w-3 h-3" />Видео</Label>
                {video.heygen_video_url ? (
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                    <video src={video.heygen_video_url} controls className="w-full h-full object-contain" poster={video.front_cover_url || undefined} />
                  </div>
                ) : (
                  <div className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Play className="w-5 h-5 text-muted-foreground/40" /></div>
                    <span className="text-[9px] text-muted-foreground/40">Видео не сгенерировано</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status selectors */}
            <div className="grid grid-cols-2 gap-3">
              <PanelField label="Обложка" labelWidth="60px">
                <Select value={normalizedCoverStatus} onValueChange={handleCoverStatusChange}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{coverStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}><span className={o.color}>{o.label}</span></SelectItem>)}</SelectContent>
                </Select>
              </PanelField>
              <PanelField label="Видео" labelWidth="60px">
                <Select value={video.generation_status || 'pending'} onValueChange={handleVideoStatusChange}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{videoStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}><span className={o.color}>{o.label}</span></SelectItem>)}</SelectContent>
                </Select>
              </PanelField>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-2 mt-3">
            <Textarea value={atmospherePromptText} onChange={(e) => setAtmospherePromptText(e.target.value)} placeholder="Промт для генерации атмосферы..." className="min-h-[200px] text-xs font-mono" rows={10} />
            <p className="text-[10px] text-muted-foreground">Отредактируйте промт перед генерацией. Промт подтянут из настроек.</p>
          </TabsContent>

          <TabsContent value="answer" className="space-y-3 mt-3">
            <label className="text-sm font-medium">Ответ духовника</label>
            <Textarea value={advisorAnswer} onChange={(e) => setAdvisorAnswer(e.target.value)} onBlur={handleAdvisorAnswerSave} placeholder="Введите ответ духовника..." className="min-h-[200px] text-sm" />
            <p className="text-[10px] text-muted-foreground">Текст сохраняется автоматически при потере фокуса.</p>
          </TabsContent>
        </Tabs>
      </PanelSection>

      <Separator />

      {/* Meta fields */}
      <div className="space-y-2">
        <PanelField label="Cover URL" labelWidth="100px">
          <Input value={video.front_cover_url || ''} onChange={(e) => onUpdateVideo(video.id, { front_cover_url: e.target.value })} className="h-7 text-xs" />
        </PanelField>
        <PanelField label="Video URL" labelWidth="100px">
          <div className="text-xs text-muted-foreground truncate">{video.heygen_video_url || '—'}</div>
        </PanelField>
        <PanelField label="Длительность" labelWidth="100px">
          <div className="text-xs text-muted-foreground">{video.video_duration ? `${video.video_duration}s` : '—'}</div>
        </PanelField>
      </div>
    </UnifiedPanel>
  );
}
