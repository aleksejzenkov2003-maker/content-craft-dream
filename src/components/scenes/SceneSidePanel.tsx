import { useEffect, useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlaylistScene } from '@/hooks/usePlaylistScenes';
import { Playlist } from '@/hooks/usePlaylists';
import { Advisor } from '@/hooks/useAdvisors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Star, Loader2, Upload, Wand2, Check } from 'lucide-react';

interface SceneSidePanelProps {
  scene: PlaylistScene | null;
  playlist: Playlist | null;
  advisor: Advisor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateScene: (id: string, updates: Partial<PlaylistScene>) => Promise<void>;
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
}: SceneSidePanelProps) {
  const [prefilled, setPrefilled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [currentVariant, setCurrentVariant] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill scene_prompt from active DB prompt if empty
  useEffect(() => {
    const prefillPrompt = async () => {
      if (!scene || !playlist || !advisor || scene.scene_prompt || prefilled) return;
      
      const { data: dbPrompt } = await supabase
        .from('prompts')
        .select('user_template')
        .eq('type', 'scene')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (dbPrompt) {
        const filled = dbPrompt.user_template
          .replace(/\{\{playlist\}\}/g, playlist.name || '')
          .replace(/\{\{advisor\}\}/g, advisor.display_name || advisor.name || '');
        await onUpdateScene(scene.id, { scene_prompt: filled });
        setPrefilled(true);
      }
    };
    prefillPrompt();
  }, [scene?.id, scene?.scene_prompt, playlist, advisor, prefilled]);

  useEffect(() => {
    setPrefilled(false);
    setCurrentVariant(0);
  }, [scene?.id]);

  if (!scene || !playlist || !advisor) return null;

  const status = scene.status || 'waiting';
  // Scene URL could potentially hold multiple variants in the future; for now single
  const sceneUrls = scene.scene_url ? [scene.scene_url] : [];

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const primaryPhoto = advisor.photos?.find(p => p.is_primary) || advisor.photos?.[0];

      const response = await supabase.functions.invoke('generate-scene', {
        body: {
          playlistId: playlist.id,
          advisorId: advisor.id,
          prompt: scene.scene_prompt || `Professional scene for ${playlist.name}`,
          advisorPhotoUrl: primaryPhoto?.photo_url,
        },
      });

      if (response.error) throw response.error;
      toast.success('Сцена сгенерирована!');
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error('Ошибка генерации сцены');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `scenes/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage
        .from('media-files')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      await onUpdateScene(scene.id, { scene_url: urlData.publicUrl });
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

  const handlePromptChange = async (prompt: string) => {
    await onUpdateScene(scene.id, { scene_prompt: prompt });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-md overflow-y-auto p-0">
        <div className="p-5 space-y-4">
          {/* Header fields */}
          <SheetHeader className="pb-0">
            <SheetTitle className="sr-only">Редактирование сцены</SheetTitle>
          </SheetHeader>

          <div className="space-y-3">
            <Input
              value={playlist.name}
              readOnly
              className="font-semibold text-base bg-muted/30"
            />
            <Input
              value={advisor.display_name || advisor.name}
              readOnly
              className="bg-muted/30"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image">Генерация изображения</TabsTrigger>
              <TabsTrigger value="prompt">Промт</TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="mt-4 space-y-4">
              <div className="flex gap-4">
                {/* Image area */}
                <div className="flex-1">
                  {/* Variant indicators */}
                  {sceneUrls.length > 1 && (
                    <div className="flex items-center gap-1 mb-2">
                      {sceneUrls.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentVariant(i)}
                          className={`w-7 h-7 rounded-full border-2 text-xs font-medium flex items-center justify-center transition-colors ${
                            i === currentVariant
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Image preview with arrows */}
                  <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden border">
                    {sceneUrls.length > 0 ? (
                      <>
                        <img
                          src={sceneUrls[currentVariant] || sceneUrls[0]}
                          alt="Scene"
                          className="w-full h-full object-cover"
                        />
                        {/* Star indicator */}
                        {status === 'approved' && (
                          <div className="absolute top-2 right-2">
                            <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                          </div>
                        )}
                        {/* Navigation arrows */}
                        {sceneUrls.length > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentVariant(Math.max(0, currentVariant - 1))}
                              className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/80 rounded-full flex items-center justify-center"
                              disabled={currentVariant === 0}
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setCurrentVariant(Math.min(sceneUrls.length - 1, currentVariant + 1))}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/80 rounded-full flex items-center justify-center"
                              disabled={currentVariant === sceneUrls.length - 1}
                            >
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

                    {/* Status badge at bottom */}
                    <div className="absolute bottom-0 inset-x-0 flex justify-center pb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 pt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="whitespace-nowrap"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-1" />
                    )}
                    Сгенерировать
                  </Button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="whitespace-nowrap"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    Загрузить
                  </Button>
                </div>
              </div>

              {/* Approve button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleApprove}
                disabled={status === 'approved' || !scene.scene_url}
              >
                <Check className="w-4 h-4 mr-2" />
                Утвердить
              </Button>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4 space-y-3">
              <Textarea
                value={scene.scene_prompt || ''}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Опишите желаемую сцену..."
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Промт предзаполняется из настроек. Отредактируйте перед генерацией.
              </p>
            </TabsContent>
          </Tabs>

          {/* Metadata */}
          <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
            <p>Создано: {new Date(scene.created_at).toLocaleString('ru')}</p>
            <p>Обновлено: {new Date(scene.updated_at).toLocaleString('ru')}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
