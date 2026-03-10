import { useState, useEffect, useCallback } from 'react';
import { UnifiedPanel, PanelField } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, Sparkles, ExternalLink, RefreshCw, Video as VideoIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
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

export function PublicationEditDialog({
  publication, open, onClose, onSave, onPrev, onNext,
}: PublicationEditDialogProps) {
  const [title, setTitle] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [promptText, setPromptText] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('text');

  const fillPromptVars = useCallback((template: string, pub: Publication) => {
    return template
      .replace(/\{\{question\}\}/g, pub.video?.question || '')
      .replace(/\{\{hook\}\}/g, pub.video?.hook || '')
      .replace(/\{\{answer\}\}/g, pub.video?.advisor_answer || '')
      .replace(/\{\{advisor\}\}/g, pub.video?.advisor?.display_name || pub.video?.advisor?.name || '')
      .replace(/\{\{video_title\}\}/g, pub.video?.video_title || '')
      .replace(/\{\{channel\}\}/g, pub.channel?.name || '')
      .replace(/\{\{network_type\}\}/g, pub.channel?.network_type || '');
  }, []);

  useEffect(() => {
    if (publication) {
      setTitle(publication.video?.video_title || publication.video?.question || '');
      setGeneratedText(publication.generated_text || '');
      setIsReady(publication.publication_status === 'checked' || publication.publication_status === 'scheduled' || publication.publication_status === 'published');
    }
  }, [publication]);

  useEffect(() => {
    const fetchPrompt = async () => {
      if (!publication) return;
      let template = '';
      if (publication.channel?.post_text_prompt) {
        template = publication.channel.post_text_prompt;
      } else {
        const { data: dbPrompt } = await supabase
          .from('prompts')
          .select('user_template')
          .eq('type', 'post_text')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (dbPrompt) template = dbPrompt.user_template;
      }
      const filled = fillPromptVars(template, publication);
      setPromptText(filled);
      setOriginalPrompt(filled);
    };
    fetchPrompt();
  }, [publication?.id, fillPromptVars]);

  const handleGenerateText = async () => {
    if (!publication) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-post-text', {
        body: { publicationId: publication.id },
      });
      if (error) throw error;
      if (data?.generated_text) {
        setGeneratedText(data.generated_text);
        toast.success('Текст сгенерирован');
      }
    } catch (e) {
      console.error('Error generating text:', e);
      toast.error('Ошибка генерации текста');
    } finally {
      setGenerating(false);
    }
  };

  const handleRestorePrompt = () => {
    setPromptText(originalPrompt);
    toast.info('Промт восстановлен из шаблона');
  };

  const handleSave = async () => {
    if (!publication) return;
    setSaving(true);
    try {
      await onSave(publication.id, {
        generated_text: generatedText || null,
        publication_status: isReady ? 'checked' : 'pending',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!publication) return null;

  const channelName = publication.channel?.name || 'канал';
  const networkType = publication.channel?.network_type || '';
  const hook = publication.video?.hook || '';
  const postDateFormatted = publication.post_date
    ? format(new Date(publication.post_date), 'dd MMMM yyyy, HH:mm', { locale: ru })
    : '—';

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Редактирование публикации"
      width="lg"
      onPrev={onPrev}
      onNext={onNext}
      preventOutsideClose
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRestorePrompt}>
              Восстановить
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </div>
      }
    >
      {/* Info fields */}
      <div className="space-y-3">
        <PanelField label="Название" labelWidth="160px">
          <span className="text-sm">{publication.video?.video_title || publication.video?.question || '—'}</span>
        </PanelField>
        <PanelField label="Хук" labelWidth="160px">
          <span className="text-sm">{hook || '—'}</span>
        </PanelField>
        <PanelField label="Канал публикации" labelWidth="160px">
          <span className="text-sm font-medium">{channelName}{networkType ? ` (${networkType})` : ''}</span>
        </PanelField>
        <PanelField label="Плановая публикация" labelWidth="160px">
          <span className="text-sm">{postDateFormatted}</span>
        </PanelField>
      </div>

      <Separator className="my-2" />

      {/* Tabs: Генерация текста / Промт / Финальное видео */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="text" className="text-xs gap-1">
            Генерация Текста
            {generating && <Loader2 className="w-3 h-3 animate-spin" />}
          </TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs">Промт</TabsTrigger>
          <TabsTrigger value="video" className="text-xs gap-1">
            <VideoIcon className="w-3 h-3" />
            Финальное видео
          </TabsTrigger>
        </TabsList>

        {/* Text tab */}
        <TabsContent value="text" className="space-y-3 mt-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="text-sm font-medium"
          />
          <Textarea
            value={generatedText}
            onChange={(e) => setGeneratedText(e.target.value)}
            placeholder="Сгенерированное текстовое описание..."
            rows={12}
            className="resize-y text-sm border-primary/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{generatedText.length} символов</span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={handleGenerateText}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              {generatedText ? 'Перегенерировать' : 'Сгенерировать'}
            </Button>
          </div>
        </TabsContent>

        {/* Prompt tab */}
        <TabsContent value="prompt" className="space-y-3 mt-3">
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Промт для генерации текста публикации..."
            className="min-h-[250px] text-xs font-mono resize-y"
            rows={14}
          />
          <p className="text-[10px] text-muted-foreground">
            Промт подтянут из настроек канала. Можно отредактировать и запустить генерацию.
          </p>
        </TabsContent>

        {/* Final video tab */}
        <TabsContent value="video" className="mt-3">
          {publication.final_video_url ? (
            <div className="space-y-3">
              <video
                src={publication.final_video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[50vh] rounded-lg object-contain bg-black"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <a
                  href={publication.final_video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Открыть видео
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <VideoIcon className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Финальное видео ещё не готово</p>
              <p className="text-xs mt-1">Сначала выполните склейку видео</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Separator className="my-2" />

      {/* Readiness + Publish */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="pub-ready"
            checked={isReady}
            onCheckedChange={(v) => setIsReady(!!v)}
          />
          <label htmlFor="pub-ready" className="text-sm font-medium cursor-pointer">
            Готовность
          </label>
        </div>

        <Button
          className="w-full"
          disabled={!isReady || publication.publication_status === 'published'}
          onClick={() => {
            toast.info(`Публикация в ${channelName} запущена`);
            // Publication logic handled by parent
          }}
        >
          Опубликовать в {channelName}
        </Button>

        {/* Links */}
        {(publication.final_video_url || publication.post_url) && (
          <div className="space-y-1 text-xs">
            {publication.final_video_url && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-[140px] shrink-0">Ссылка на финальное видео</span>
                <a href={publication.final_video_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                  {publication.final_video_url}
                </a>
              </div>
            )}
            {publication.post_url && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-[140px] shrink-0">Ссылка на публикацию</span>
                <a href={publication.post_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                  {publication.post_url}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {publication.error_message && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive font-medium">Ошибка:</p>
          <p className="text-sm text-destructive/80 mt-1">{publication.error_message}</p>
        </div>
      )}
    </UnifiedPanel>
  );
}
