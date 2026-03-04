import { useState, useEffect } from 'react';
import { UnifiedPanel, PanelField, PanelSection } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CalendarIcon, Clock, Loader2, Sparkles,
  ExternalLink, FileText, Settings2, Volume2,
} from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Publication } from '@/hooks/usePublications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PublicationEditDialogProps {
  publication: Publication | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Publication>) => Promise<void>;
  onPrev?: () => void;
  onNext?: () => void;
}

const statusOptions = [
  { value: 'pending', label: 'Ожидает', color: 'text-muted-foreground' },
  { value: 'checked', label: 'Проверено', color: 'text-emerald-600' },
  { value: 'needs_concat', label: 'Ожидает склейки', color: 'text-orange-600' },
  { value: 'scheduled', label: 'Запланирован', color: 'text-blue-600' },
  { value: 'publishing', label: 'Публикуется', color: 'text-yellow-600' },
  { value: 'published', label: 'Опубликован', color: 'text-green-600' },
  { value: 'failed', label: 'Ошибка', color: 'text-destructive' },
];

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function PublicationEditDialog({
  publication, open, onClose, onSave, onPrev, onNext,
}: PublicationEditDialogProps) {
  const [generatedText, setGeneratedText] = useState('');
  const [status, setStatus] = useState('pending');
  const [postDate, setPostDate] = useState<Date | undefined>();
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [postUrl, setPostUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (publication) {
      setGeneratedText(publication.generated_text || '');
      setStatus(publication.publication_status || 'pending');
      setPostUrl(publication.post_url || '');
      if (publication.post_date) {
        const date = new Date(publication.post_date);
        setPostDate(date);
        setHour(date.getHours());
        setMinute(date.getMinutes());
      } else { setPostDate(undefined); setHour(12); setMinute(0); }
    }
  }, [publication]);

  useEffect(() => {
    const fetchPrompt = async () => {
      if (!publication) return;
      const channelPrompt = publication.channel?.post_text_prompt;
      if (channelPrompt) { setPromptText(fillPromptVars(channelPrompt, publication)); return; }
      const { data: dbPrompt } = await supabase.from('prompts').select('user_template').eq('type', 'post_text').eq('is_active', true).limit(1).single();
      if (dbPrompt) setPromptText(fillPromptVars(dbPrompt.user_template, publication));
    };
    fetchPrompt();
  }, [publication?.id]);

  const fillPromptVars = (template: string, pub: Publication) => {
    return template
      .replace(/\{\{question\}\}/g, pub.video?.question || '')
      .replace(/\{\{hook\}\}/g, pub.video?.hook || '')
      .replace(/\{\{answer\}\}/g, pub.video?.advisor_answer || '')
      .replace(/\{\{advisor\}\}/g, pub.video?.advisor?.display_name || pub.video?.advisor?.name || '');
  };

  const handleGenerateText = async () => {
    if (!publication) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-post-text', { body: { publicationId: publication.id } });
      if (error) throw error;
      if (data?.generated_text) { setGeneratedText(data.generated_text); toast.success('Текст сгенерирован'); }
    } catch (e) { console.error('Error generating text:', e); toast.error('Ошибка генерации текста'); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!publication) return;
    setSaving(true);
    try {
      let finalDate: string | null = null;
      if (postDate) { let d = setHours(postDate, hour); d = setMinutes(d, minute); finalDate = d.toISOString(); }
      await onSave(publication.id, { generated_text: generatedText || null, publication_status: status, post_date: finalDate, post_url: postUrl || null });
      onClose();
    } finally { setSaving(false); }
  };

  const getPublicationTitle = () => {
    if (!publication) return '';
    const question = publication.video?.question || 'Без вопроса';
    const advisor = publication.video?.advisor?.display_name || publication.video?.advisor?.name || '';
    return advisor ? `${question} — ${advisor}` : question;
  };

  if (!publication) return null;

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={getPublicationTitle()}
      width="lg"
      onPrev={onPrev}
      onNext={onNext}
      preventOutsideClose
      headerActions={
        publication.post_url ? (
          <a href={publication.post_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded" title="Открыть публикацию">
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : undefined
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Сохранить
          </Button>
        </>
      }
    >
      {/* Channel + Video info */}
      <div className="flex items-center gap-3 flex-wrap">
        {publication.channel && <Badge variant="outline" className="text-xs">{publication.channel.name} ({publication.channel.network_type})</Badge>}
        {publication.video?.video_number && <Badge variant="secondary" className="font-mono text-xs">Ролик #{publication.video.video_number}</Badge>}
        {publication.video?.video_duration && <span className="text-xs text-muted-foreground">{publication.video.video_duration}s</span>}
      </div>

      {/* Status */}
      <PanelField label="Статус">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}><span className={opt.color}>{opt.label}</span></SelectItem>)}</SelectContent>
        </Select>
      </PanelField>

      {/* Date and time */}
      <PanelField label="Плановая публикация">
        <div className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('justify-start text-left text-sm', !postDate && 'text-muted-foreground')}>
                <CalendarIcon className="w-3 h-3 mr-2" />
                {postDate ? format(postDate, 'dd.MM.yyyy', { locale: ru }) : 'Выбрать дату'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={postDate} onSelect={setPostDate} locale={ru} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
              <SelectTrigger className="w-[60px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[200px]">{hours.map((h) => <SelectItem key={h} value={h.toString()}>{h.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-sm">:</span>
            <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
              <SelectTrigger className="w-[60px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[200px]">{minutes.map((m) => <SelectItem key={m} value={m.toString()}>{m.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </PanelField>

      {/* Post URL */}
      <PanelField label="Ссылка на пост">
        <div className="flex gap-2 items-center">
          <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm flex-1" />
          {postUrl && <a href={postUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded border shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
        </div>
      </PanelField>

      {/* Voiceover */}
      {publication.video?.voiceover_url && (
        <>
          <Separator />
          <PanelSection title="Озвучка" icon={<Volume2 className="w-4 h-4" />}>
            <audio controls className="w-full h-8" src={publication.video.voiceover_url}>Your browser does not support the audio element.</audio>
          </PanelSection>
        </>
      )}

      <Separator />

      {/* Text tabs */}
      <PanelSection title="Текст публикации">
        <Tabs defaultValue="text">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="text" className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" />Текст</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs flex items-center gap-1"><Settings2 className="w-3 h-3" />Промт</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{generatedText.length} символов</span>
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleGenerateText} disabled={generating}>
                {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                {generatedText ? 'Перегенерировать' : 'Сгенерировать'}
              </Button>
            </div>
            <Textarea value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} placeholder="Введите или сгенерируйте текст публикации..." rows={10} className="resize-y text-sm" />
          </TabsContent>
          <TabsContent value="prompt" className="space-y-2 mt-3">
            <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="Промт для генерации текста публикации..." className="min-h-[200px] text-xs font-mono" rows={10} />
            <p className="text-[10px] text-muted-foreground">Промт подтянут из настроек канала или общих настроек. Можно отредактировать перед генерацией.</p>
          </TabsContent>
        </Tabs>
      </PanelSection>

      {/* Error */}
      {publication.error_message && (
        <>
          <Separator />
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">Ошибка публикации:</p>
            <p className="text-sm text-destructive/80 mt-1">{publication.error_message}</p>
          </div>
        </>
      )}

      {/* Final video */}
      {publication.final_video_url && (
        <>
          <Separator />
          <PanelField label="Финальное видео" labelWidth="140px">
            <a href={publication.final_video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">{publication.final_video_url}</a>
          </PanelField>
        </>
      )}
    </UnifiedPanel>
  );
}
