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
  Loader2, Sparkles, ExternalLink, RefreshCw, Video as VideoIcon, ArrowUpRight,
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
  }, [publication?.id]);

  useEffect(() => {
    const fetchPrompt = async () => {
      if (!publication) return;
      let systemPrompt = '';
      let userTemplate = '';

      // Priority 1: channel.prompt_id → fetch from prompts table
      if (publication.channel?.prompt_id) {
        const { data: promptData } = await supabase
          .from('prompts')
          .select('system_prompt, user_template')
          .eq('id', publication.channel.prompt_id)
          .single();
        if (promptData) {
          systemPrompt = promptData.system_prompt || '';
          userTemplate = promptData.user_template || '';
        }
      }
      // Priority 2: legacy post_text_prompt on channel
      if (!userTemplate && publication.channel?.post_text_prompt) {
        userTemplate = publication.channel.post_text_prompt;
      }
      // Priority 3: global active post_text prompt
      if (!userTemplate) {
        const { data: dbPrompt } = await supabase
          .from('prompts')
          .select('system_prompt, user_template')
          .eq('type', 'post_text')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (dbPrompt) {
          systemPrompt = dbPrompt.system_prompt || '';
          userTemplate = dbPrompt.user_template || '';
        }
      }

      const filledUser = fillPromptVars(userTemplate, publication);
      const filledSystem = fillPromptVars(systemPrompt, publication);
      const combined = filledSystem
        ? `--- Системный промт ---\n${filledSystem}\n\n--- Шаблон пользователя ---\n${filledUser}`
        : filledUser;
      setPromptText(combined);
      setOriginalPrompt(combined);
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
      // Save title to video first (before refetch)
      const originalTitle = publication.video?.video_title || publication.video?.question || '';
      if (title !== originalTitle && publication.video_id) {
        await supabase.from('videos').update({ video_title: title }).eq('id', publication.video_id);
      }
      // Save publication fields (may trigger refetch)
      await onSave(publication.id, {
        generated_text: generatedText || null,
        publication_status: isReady ? 'checked' : 'pending',
      });
      toast.success('Сохранено');
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
      fixedHeight
      footer={null}
    >
      {/* Info fields */}
      <div className="space-y-3">
        <PanelField label="Название" labelWidth="160px">
          <span className="text-sm truncate min-w-0">{title || '—'}</span>
        </PanelField>
        <PanelField label="Хук" labelWidth="160px">
          <span className="text-sm truncate min-w-0">{hook || '—'}</span>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full overflow-hidden">
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
        <TabsContent value="text" className="space-y-3 mt-3 overflow-hidden">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="text-sm font-medium min-w-0 w-full"
          />
          <Textarea
            value={generatedText}
            onChange={(e) => setGeneratedText(e.target.value)}
            placeholder="Сгенерированное текстовое описание..."
            rows={12}
            className="resize-y text-sm border-primary/30 min-w-0 w-full"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{generatedText.length} символов</span>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRestorePrompt}>
                Восстановить
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Сохранить
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Prompt tab */}
        <TabsContent value="prompt" className="space-y-3 mt-3 overflow-hidden">
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Промт для генерации текста публикации..."
            className="min-h-[250px] text-xs font-mono resize-y min-w-0 w-full"
            rows={14}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Промт подтянут из настроек канала.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRestorePrompt}>
                Восстановить
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Сохранить
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Final video tab */}
        <TabsContent value="video" className="mt-3 overflow-hidden">
          {publication.final_video_url ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <video
                  src={publication.final_video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[50vh] rounded-lg"
                />
              </div>
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
            Проверено
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
        <div className="space-y-1 text-xs">
          {publication.final_video_url && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-[140px] shrink-0">Ссылка на видео</span>
              <a href={publication.final_video_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                {publication.final_video_url}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-[140px] shrink-0">Ссылка на публикацию</span>
            {publication.post_url ? (
              <a href={publication.post_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                {publication.post_url}
              </a>
            ) : (
              <span className="text-muted-foreground">Не опубликовано</span>
            )}
          </div>
        </div>
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
