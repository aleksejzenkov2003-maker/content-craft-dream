import { useEffect, useState, useRef, useCallback } from 'react';
import { UnifiedPanel } from '@/components/ui/unified-panel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlaylistScene, SceneVariant } from '@/hooks/usePlaylistScenes';
import { Playlist } from '@/hooks/usePlaylists';
import { Advisor } from '@/hooks/useAdvisors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Star, Loader2, Upload, Wand2, Check, RotateCcw, Save } from 'lucide-react';

interface SceneSidePanelProps {
  scene: PlaylistScene | null;
  playlist: Playlist | null;
  advisor: Advisor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateScene: (id: string, updates: Partial<PlaylistScene>) => Promise<void>;
  fetchVariants: (sceneId: string) => Promise<SceneVariant[]>;
  selectVariant: (variantId: string, sceneId: string) => Promise<void>;
}

const statusLabels: Record<string, string> = {
  waiting: 'Ожидает',
  generating: 'Генерация',
  approved: 'Готово',
  cancelled: 'Отменено',
};

const statusColors: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  generating: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function SceneSidePanel({
  scene,
  playlist,
  advisor,
  open,
  onOpenChange,
  onUpdateScene,
  fetchVariants,
  selectVariant,
}: SceneSidePanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [currentVariant, setCurrentVariant] = useState(0);
  const [variants, setVariants] = useState<SceneVariant[]>([]);
  const [promptText, setPromptText] = useState('');
  const [systemPromptText, setSystemPromptText] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load variants when scene changes
  const loadVariants = useCallback(async () => {
    if (!scene) return;
    const v = await fetchVariants(scene.id);
    setVariants(v);
    // Set current to the selected one
    const selectedIdx = v.findIndex(x => x.is_selected);
    setCurrentVariant(selectedIdx >= 0 ? selectedIdx : v.length - 1);
  }, [scene?.id, fetchVariants]);

  useEffect(() => {
    if (open && scene) {
      loadVariants();
      setPromptText(scene.scene_prompt || '');
      loadSystemPrompt();
    }
  }, [open, scene?.id]);

  // Load system prompt from active scene prompt template
  const loadSystemPrompt = useCallback(async () => {
    const { data } = await supabase
      .from('prompts')
      .select('system_prompt, user_template')
      .eq('type', 'scene')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (data) {
      setSystemPromptText(data.system_prompt || '');
      // Prefill user prompt if scene has no prompt yet
      if (scene && !scene.scene_prompt && playlist && advisor) {
        const filled = data.user_template
          .replace(/\{\{playlist\}\}/g, playlist.name || '')
          .replace(/\{\{advisor\}\}/g, advisor.display_name || advisor.name || '');
        setPromptText(filled);
        await onUpdateScene(scene.id, { scene_prompt: filled });
      }
    }
  }, [scene?.id, scene?.scene_prompt, playlist, advisor]);

  if (!scene || !playlist || !advisor) return null;

  const status = scene.status || 'waiting';
  // Build image list: from variants, or fallback to scene_url
  const imageUrls = variants.length > 0
    ? variants.map(v => v.image_url)
    : scene.scene_url ? [scene.scene_url] : [];

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const primaryPhoto = advisor.photos?.find(p => p.id === advisor.scene_photo_id) || advisor.photos?.find(p => p.is_primary) || advisor.photos?.[0];
      const response = await supabase.functions.invoke('generate-scene', {
        body: {
          sceneId: scene.id,
          playlistId: playlist.id,
          advisorId: advisor.id,
          prompt: promptText || scene.scene_prompt || `Professional scene for ${playlist.name}`,
          advisorPhotoUrl: primaryPhoto?.photo_url,
        },
      });
      if (response.error) throw response.error;
      toast.success('Сцена сгенерирована!');
      await loadVariants();
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error('Ошибка генерации сцены');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Выберите изображение'); return; }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `scenes/${scene.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('media-files').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);

      // Deselect all, insert new variant as selected
      await supabase.from('scene_variants').update({ is_selected: false }).eq('scene_id', scene.id);
      await supabase.from('scene_variants').insert({
        scene_id: scene.id,
        image_url: urlData.publicUrl,
        prompt_used: promptText || null,
        is_selected: true,
      });

      await onUpdateScene(scene.id, { scene_url: urlData.publicUrl });
      await loadVariants();
      toast.success('Изображение загружено');
    } catch (error: any) {
      toast.error('Ошибка загрузки');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async () => {
    await onUpdateScene(scene.id, { status: 'approved' });
    toast.success('Сцена утверждена');
  };

  const handleSelectVariant = async (index: number) => {
    setCurrentVariant(index);
    if (variants[index]) {
      await selectVariant(variants[index].id, scene.id);
      await loadVariants();
    }
  };

  const handleRestorePrompt = async () => {
    const { data } = await supabase
      .from('prompts')
      .select('user_template')
      .eq('type', 'scene')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (data) {
      const filled = data.user_template
        .replace(/\{\{playlist\}\}/g, playlist.name || '')
        .replace(/\{\{advisor\}\}/g, advisor.display_name || advisor.name || '');
      setPromptText(filled);
      toast.success('Промт восстановлен из шаблона');
    } else {
      toast.error('Активный шаблон не найден');
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      await onUpdateScene(scene.id, { scene_prompt: promptText });
      toast.success('Промт сохранён');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Редактирование сцены"
      width="sm"
    >
      {/* Header fields */}
      <div className="space-y-3">
        <Input value={playlist.name} readOnly className="font-semibold text-base bg-muted/30 h-8 text-sm" />
        <Input value={advisor.display_name || advisor.name} readOnly className="bg-muted/30 h-8 text-sm" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="image" className="text-xs">Генерация изображения</TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs">Промт</TabsTrigger>
        </TabsList>

        <div className="min-h-[420px]">
          <TabsContent value="image" className="mt-4 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                {/* Variant indicators */}
                {imageUrls.length > 1 && (
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {imageUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectVariant(i)}
                        className={`w-7 h-7 rounded-full border-2 text-xs font-medium flex items-center justify-center transition-colors ${
                          i === currentVariant
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden border">
                  {imageUrls.length > 0 ? (
                    <>
                      <img src={imageUrls[currentVariant] || imageUrls[0]} alt="Scene" className="w-full h-full object-cover" />
                      {variants[currentVariant]?.is_selected && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                        </div>
                      )}
                      {imageUrls.length > 1 && (
                        <>
                          <button onClick={() => setCurrentVariant(Math.max(0, currentVariant - 1))} className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/80 rounded-full flex items-center justify-center" disabled={currentVariant === 0}>
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button onClick={() => setCurrentVariant(Math.min(imageUrls.length - 1, currentVariant + 1))} className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/80 rounded-full flex items-center justify-center" disabled={currentVariant === imageUrls.length - 1}>
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      Нет изображения
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 flex justify-center pb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                      {statusLabels[status]}
                    </span>
                  </div>
                </div>

                {/* Prompt used for current variant */}
                {variants[currentVariant]?.prompt_used && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2" title={variants[currentVariant].prompt_used!}>
                    <span className="font-medium">Промт:</span> {variants[currentVariant].prompt_used}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-8 shrink-0">
                <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={isGenerating} className="whitespace-nowrap">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
                  Сгенерировать
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="whitespace-nowrap">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                  Загрузить
                </Button>
              </div>
            </div>

            <Button variant="secondary" className="w-full" size="sm" onClick={handleApprove} disabled={status === 'approved' || !scene.scene_url}>
              <Check className="w-4 h-4 mr-2" />
              Утвердить
            </Button>
          </TabsContent>

          <TabsContent value="prompt" className="mt-4 space-y-3">
            {/* System prompt (read-only) */}
            {systemPromptText && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Системный промт</label>
                <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto border whitespace-pre-wrap">
                  {systemPromptText}
                </div>
              </div>
            )}

            {/* Editable user prompt */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Пользовательский промт</label>
              <Textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Опишите желаемую сцену..."
                rows={8}
                className="resize-none text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRestorePrompt} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-1" />
                Восстановить
              </Button>
              <Button variant="default" size="sm" onClick={handleSavePrompt} disabled={isSavingPrompt} className="flex-1">
                {isSavingPrompt ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Сохранить
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              «Восстановить» — подставит промт из активного шаблона с заполненными переменными.
            </p>
          </TabsContent>
        </div>
      </Tabs>

      {/* Metadata */}
      <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
        <p>Создано: {new Date(scene.created_at).toLocaleString('ru')}</p>
        <p>Обновлено: {new Date(scene.updated_at).toLocaleString('ru')}</p>
      </div>
    </UnifiedPanel>
  );
}
