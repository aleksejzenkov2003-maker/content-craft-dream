import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Sparkles, Check, X, Loader2, Image, Upload } from 'lucide-react';
import { usePlaylistScenes, PlaylistScene } from '@/hooks/usePlaylistScenes';
import { useAdvisors, Advisor } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { ImageInput } from '@/components/ui/image-input';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  waiting: { label: 'Ожидает', variant: 'secondary' },
  generating: { label: 'Генерация...', variant: 'outline' },
  approved: { label: 'Утверждено', variant: 'default' },
  cancelled: { label: 'Отменено', variant: 'destructive' },
};

export function ScenesMatrix() {
  const { scenes, loading: scenesLoading, addScene, updateScene } = usePlaylistScenes();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const { playlists, loading: playlistsLoading } = usePlaylists();
  
  const [selectedScene, setSelectedScene] = useState<PlaylistScene | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSceneData, setNewSceneData] = useState<{
    playlistId: string;
    advisorId: string;
    prompt: string;
    uploadedUrl: string;
    mode: 'generate' | 'upload';
  } | null>(null);

  const loading = scenesLoading || advisorsLoading || playlistsLoading;

  // Get scene for specific playlist and advisor
  const getScene = (playlistId: string, advisorId: string): PlaylistScene | undefined => {
    return scenes.find(s => s.playlist_id === playlistId && s.advisor_id === advisorId);
  };

  const handleCreateScene = async () => {
    if (!newSceneData) return;

    try {
      if (newSceneData.mode === 'upload' && newSceneData.uploadedUrl) {
        // Direct upload mode - save to database directly
        await addScene({
          playlist_id: newSceneData.playlistId,
          advisor_id: newSceneData.advisorId,
          scene_url: newSceneData.uploadedUrl,
          scene_prompt: newSceneData.prompt,
          status: 'approved',
        });
      } else {
        // Generate mode - call edge function
        const advisor = advisors.find(a => a.id === newSceneData.advisorId);
        const advisorPhotoUrl = advisor?.photos?.find(p => p.is_primary)?.photo_url;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            playlistId: newSceneData.playlistId,
            advisorId: newSceneData.advisorId,
            prompt: newSceneData.prompt,
            advisorPhotoUrl,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate scene');
        }
      }

      setNewSceneData(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating scene:', error);
    }
  };

  const handleApprove = async (scene: PlaylistScene) => {
    await updateScene(scene.id, { status: 'approved' });
  };

  const handleCancel = async (scene: PlaylistScene) => {
    await updateScene(scene.id, { status: 'cancelled' });
  };

  const openNewSceneDialog = (playlistId: string, advisorId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    setNewSceneData({
      playlistId,
      advisorId,
      prompt: playlist?.scene_prompt || '',
      uploadedUrl: '',
      mode: 'generate',
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Сцены для плейлистов</h2>
          <p className="text-muted-foreground">Матрица сцен: плейлисты × духовники</p>
        </div>
      </div>

      {playlists.length === 0 || advisors.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {playlists.length === 0 
                ? 'Сначала создайте плейлисты'
                : 'Сначала добавьте духовников'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left bg-muted/50 border border-border rounded-tl-lg">
                  Плейлист / Духовник
                </th>
                {advisors.map((advisor) => (
                  <th key={advisor.id} className="p-3 text-center bg-muted/50 border border-border min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium">{advisor.display_name || advisor.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playlists.map((playlist) => (
                <tr key={playlist.id}>
                  <td className="p-3 bg-muted/30 border border-border font-medium">
                    {playlist.name}
                  </td>
                  {advisors.map((advisor) => {
                    const scene = getScene(playlist.id, advisor.id);
                    return (
                      <td key={advisor.id} className="p-2 border border-border">
                        {scene ? (
                          <div className="flex flex-col items-center gap-2">
                            {scene.scene_url ? (
                              <div 
                                className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer group"
                                onClick={() => setSelectedScene(scene)}
                              >
                                <img 
                                  src={scene.scene_url} 
                                  alt="Scene" 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-sm">Открыть</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                                {scene.status === 'generating' ? (
                                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                ) : (
                                  <Image className="w-6 h-6 text-muted-foreground" />
                                )}
                              </div>
                            )}
                            <Badge variant={statusLabels[scene.status]?.variant || 'secondary'}>
                              {statusLabels[scene.status]?.label || scene.status}
                            </Badge>
                            {scene.status === 'waiting' && scene.scene_url && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => handleApprove(scene)}
                                >
                                  <Check className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => handleCancel(scene)}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            className="w-full h-20"
                            onClick={() => openNewSceneDialog(playlist.id, advisor.id)}
                          >
                            <Plus className="w-5 h-5 mr-1" />
                            Создать
                          </Button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Scene Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать сцену</DialogTitle>
          </DialogHeader>
          <Tabs 
            value={newSceneData?.mode || 'generate'} 
            onValueChange={(v) => setNewSceneData(prev => prev ? { ...prev, mode: v as 'generate' | 'upload' } : null)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">
                <Sparkles className="w-4 h-4 mr-2" />
                Генерация
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Загрузить
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="generate" className="space-y-4 mt-4">
              <div>
                <Label>Промт для генерации</Label>
                <Textarea
                  value={newSceneData?.prompt || ''}
                  onChange={(e) => setNewSceneData(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                  placeholder="Опишите сцену для генерации..."
                  rows={4}
                />
              </div>
              <Button onClick={handleCreateScene} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Сгенерировать сцену
              </Button>
            </TabsContent>
            
            <TabsContent value="upload" className="space-y-4 mt-4">
              <ImageInput
                value={newSceneData?.uploadedUrl || ''}
                onChange={(url) => setNewSceneData(prev => prev ? { ...prev, uploadedUrl: url } : null)}
                folder="scenes"
                aspectRatio="16:9"
                generatePromptPrefix="Background scene for spiritual video content."
              />
              <Button 
                onClick={handleCreateScene} 
                className="w-full"
                disabled={!newSceneData?.uploadedUrl}
              >
                <Upload className="w-4 h-4 mr-2" />
                Сохранить сцену
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Scene Preview Dialog */}
      <Dialog open={!!selectedScene} onOpenChange={() => setSelectedScene(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Просмотр сцены</DialogTitle>
          </DialogHeader>
          {selectedScene && (
            <div className="space-y-4">
              {selectedScene.scene_url && (
                <img 
                  src={selectedScene.scene_url} 
                  alt="Scene" 
                  className="w-full rounded-lg"
                />
              )}
              <div className="flex items-center justify-between">
                <Badge variant={statusLabels[selectedScene.status]?.variant || 'secondary'}>
                  {statusLabels[selectedScene.status]?.label || selectedScene.status}
                </Badge>
                {selectedScene.status === 'waiting' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleCancel(selectedScene);
                        setSelectedScene(null);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Отменить
                    </Button>
                    <Button
                      onClick={() => {
                        handleApprove(selectedScene);
                        setSelectedScene(null);
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Утвердить
                    </Button>
                  </div>
                )}
              </div>
              {selectedScene.scene_prompt && (
                <div>
                  <Label>Промт</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedScene.scene_prompt}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
