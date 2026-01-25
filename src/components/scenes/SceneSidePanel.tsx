import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ImageInput } from '@/components/ui/image-input';
import { PlaylistScene } from '@/hooks/usePlaylistScenes';
import { Playlist } from '@/hooks/usePlaylists';
import { Advisor } from '@/hooks/useAdvisors';

interface SceneSidePanelProps {
  scene: PlaylistScene | null;
  playlist: Playlist | null;
  advisor: Advisor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateScene: (id: string, updates: Partial<PlaylistScene>) => Promise<void>;
}

const statusOptions = [
  { value: 'waiting', label: 'Ожидает', variant: 'outline' as const },
  { value: 'generating', label: 'Генерация', variant: 'secondary' as const },
  { value: 'approved', label: 'Одобрено', variant: 'default' as const },
  { value: 'cancelled', label: 'Отменено', variant: 'destructive' as const },
];

export function SceneSidePanel({
  scene,
  playlist,
  advisor,
  open,
  onOpenChange,
  onUpdateScene,
}: SceneSidePanelProps) {
  if (!scene || !playlist || !advisor) {
    return null;
  }

  const currentStatus = statusOptions.find(s => s.value === scene.status) || statusOptions[0];

  const handleStatusChange = async (status: string) => {
    await onUpdateScene(scene.id, { status });
  };

  const handlePromptChange = async (prompt: string) => {
    await onUpdateScene(scene.id, { scene_prompt: prompt });
  };

  const handleImageChange = async (url: string) => {
    await onUpdateScene(scene.id, { scene_url: url, status: 'approved' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex flex-col gap-1">
            <span>{playlist.name}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {advisor.display_name || advisor.name}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Status */}
          <div className="space-y-2">
            <Label>Статус проверки</Label>
            <Select value={scene.status || 'waiting'} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant={opt.variant} className="text-xs">
                        {opt.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scene Prompt */}
          <div className="space-y-2">
            <Label>Промт для сцены</Label>
            <Textarea
              value={scene.scene_prompt || ''}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="Опишите желаемую сцену..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Этот промт будет использован для генерации сцены
            </p>
          </div>

          {/* Scene Image */}
          <div className="space-y-2">
            <Label>Изображение сцены</Label>
            <ImageInput
              value={scene.scene_url || ''}
              onChange={handleImageChange}
              folder="scenes"
              aspectRatio="9:16"
              placeholder="Загрузите или сгенерируйте сцену"
              generatePromptPrefix={`Background scene for ${playlist.name}, featuring ${advisor.display_name || advisor.name}: `}
              showPreview={true}
            />
          </div>

          {/* Scene URL (readonly) */}
          {scene.scene_url && (
            <div className="space-y-2">
              <Label>URL сцены</Label>
              <div className="p-2 bg-muted rounded-md text-sm break-all font-mono">
                {scene.scene_url}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
            <p>Создано: {new Date(scene.created_at).toLocaleString('ru')}</p>
            <p>Обновлено: {new Date(scene.updated_at).toLocaleString('ru')}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
