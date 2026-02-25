import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronRight, ChevronDown, Image, Wand2, Check, X, FileSpreadsheet } from 'lucide-react';
import { usePlaylistScenes, PlaylistScene } from '@/hooks/usePlaylistScenes';
import { useAdvisors, Advisor } from '@/hooks/useAdvisors';
import { usePlaylists, Playlist } from '@/hooks/usePlaylists';
import { SceneSidePanel } from './SceneSidePanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CsvImporter, Lookups } from '@/components/import/CsvImporter';
import { SCENE_COLUMN_MAPPING, SCENE_PREVIEW_COLUMNS, SCENE_FIELD_DEFINITIONS } from '@/components/import/importConfigs';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  waiting: { label: 'Ожидает', variant: 'outline' },
  Waiting: { label: 'Ожидает', variant: 'outline' },
  generating: { label: 'Генерация', variant: 'secondary' },
  approved: { label: 'Одобрено', variant: 'default' },
  Approved: { label: 'Одобрено', variant: 'default' },
  cancelled: { label: 'Отменено', variant: 'destructive' },
  Cancelled: { label: 'Отменено', variant: 'destructive' },
};

const reviewStatusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  Waiting: { label: 'Ожидает проверки', variant: 'outline' },
  Approved: { label: 'Проверено', variant: 'default' },
  NeedsRevision: { label: 'Требует доработки', variant: 'secondary' },
  Rejected: { label: 'Отклонено', variant: 'destructive' },
};

export function ScenesMatrix() {
  const { scenes, loading: scenesLoading, addScene, updateScene, refetch, bulkImport } = usePlaylistScenes();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const { playlists, loading: playlistsLoading } = usePlaylists();
  
  const [expandedAdvisors, setExpandedAdvisors] = useState<Set<string>>(new Set());
  const [generatingScenes, setGeneratingScenes] = useState<Set<string>>(new Set());
  const [selectedScene, setSelectedScene] = useState<PlaylistScene | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  const loading = scenesLoading || advisorsLoading || playlistsLoading;

  const sceneMap = useMemo(() => {
    const map = new Map<string, PlaylistScene>();
    scenes.forEach(scene => {
      if (scene.playlist_id && scene.advisor_id) {
        map.set(`${scene.playlist_id}-${scene.advisor_id}`, scene);
      }
    });
    return map;
  }, [scenes]);

  const getScene = (playlistId: string, advisorId: string): PlaylistScene | undefined => {
    return sceneMap.get(`${playlistId}-${advisorId}`);
  };

  const toggleAdvisor = (advisorId: string) => {
    setExpandedAdvisors(prev => {
      const next = new Set(prev);
      if (next.has(advisorId)) {
        next.delete(advisorId);
      } else {
        next.add(advisorId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedAdvisors(new Set(advisors.map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedAdvisors(new Set());
  };

  const handleGenerateScene = async (playlist: Playlist, advisor: Advisor) => {
    const key = `${playlist.id}-${advisor.id}`;
    setGeneratingScenes(prev => new Set(prev).add(key));

    try {
      const primaryPhoto = advisor.photos?.find(p => p.is_primary) || advisor.photos?.[0];

      const response = await supabase.functions.invoke('generate-scene', {
        body: {
          playlistId: playlist.id,
          advisorId: advisor.id,
          prompt: playlist.scene_prompt || `Professional scene for ${playlist.name}`,
          advisorPhotoUrl: primaryPhoto?.photo_url,
        },
      });

      if (response.error) throw response.error;

      toast.success('Сцена сгенерирована!');
      await refetch();
    } catch (error) {
      console.error('Error generating scene:', error);
      toast.error('Ошибка генерации сцены');
    } finally {
      setGeneratingScenes(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleOpenScene = (scene: PlaylistScene, playlist: Playlist, advisor: Advisor) => {
    setSelectedScene(scene);
    setSelectedPlaylist(playlist);
    setSelectedAdvisor(advisor);
    setShowSidePanel(true);
  };

  const handleCreateAndOpenScene = async (playlist: Playlist, advisor: Advisor) => {
    try {
      const newScene = await addScene({
        playlist_id: playlist.id,
        advisor_id: advisor.id,
        status: 'waiting',
        scene_prompt: playlist.scene_prompt || '',
      });
      
      if (newScene) {
        setSelectedScene(newScene);
        setSelectedPlaylist(playlist);
        setSelectedAdvisor(advisor);
        setShowSidePanel(true);
      }
    } catch (error) {
      console.error('Error creating scene:', error);
    }
  };

  const handleUpdateScene = async (id: string, updates: Partial<PlaylistScene>) => {
    await updateScene(id, updates);
    if (selectedScene && selectedScene.id === id) {
      setSelectedScene({ ...selectedScene, ...updates } as PlaylistScene);
    }
  };

  const resolveRow = (row: Record<string, any>, lookups: Lookups) => {
    const errors: string[] = [];
    const data = { ...row };
    
    // Resolve advisor by name (don't error if not found — will auto-create)
    if (data.advisor_name && lookups.advisors) {
      const advisor = lookups.advisors.find(a => 
        a.name.toLowerCase() === String(data.advisor_name).toLowerCase() ||
        a.display_name?.toLowerCase() === String(data.advisor_name).toLowerCase()
      );
      if (advisor) {
        data.advisor_id = advisor.id;
      }
      // Keep advisor_name for auto-create during import
    }
    
    // Resolve playlist by name (don't error if not found — will auto-create)
    if (data.playlist_name && lookups.playlists) {
      const playlist = lookups.playlists.find(p => 
        p.name.toLowerCase() === String(data.playlist_name).toLowerCase()
      );
      if (playlist) {
        data.playlist_id = playlist.id;
      }
      // Keep playlist_name for auto-create during import
    }

    return { data, errors };
  };

  const handleImport = async (data: Record<string, any>[]) => {
    try {
      // Auto-create missing advisors
      const advisorNames = [...new Set(
        data.filter(r => r.advisor_name && !r.advisor_id).map(r => String(r.advisor_name).trim()).filter(Boolean)
      )];
      if (advisorNames.length > 0) {
        const { data: existing } = await supabase.from('advisors').select('id, name');
        const existingMap = new Map((existing || []).map(a => [a.name.toLowerCase(), a.id]));
        const toCreate = advisorNames.filter(n => !existingMap.has(n.toLowerCase()));
        if (toCreate.length > 0) {
          const { data: created } = await supabase.from('advisors').insert(toCreate.map(name => ({ name }))).select('id, name');
          created?.forEach(a => existingMap.set(a.name.toLowerCase(), a.id));
          toast.success(`Создано ${toCreate.length} новых духовников`);
        }
        data.forEach(r => {
          if (r.advisor_name && !r.advisor_id) {
            r.advisor_id = existingMap.get(String(r.advisor_name).toLowerCase().trim()) || null;
          }
        });
      }

      // Auto-create missing playlists
      const playlistNames = [...new Set(
        data.filter(r => r.playlist_name && !r.playlist_id).map(r => String(r.playlist_name).trim()).filter(Boolean)
      )];
      if (playlistNames.length > 0) {
        const { data: existing } = await supabase.from('playlists').select('id, name');
        const existingMap = new Map((existing || []).map(p => [p.name.toLowerCase(), p.id]));
        const toCreate = playlistNames.filter(n => !existingMap.has(n.toLowerCase()));
        if (toCreate.length > 0) {
          const { data: created } = await supabase.from('playlists').insert(toCreate.map(name => ({ name }))).select('id, name');
          created?.forEach(p => existingMap.set(p.name.toLowerCase(), p.id));
          toast.success(`Создано ${toCreate.length} новых плейлистов`);
        }
        data.forEach(r => {
          if (r.playlist_name && !r.playlist_id) {
            r.playlist_id = existingMap.get(String(r.playlist_name).toLowerCase().trim()) || null;
          }
        });
      }

      // Strip virtual fields before DB insert
      const cleaned = data.map(r => {
        const { advisor_name, playlist_name, scene_name, _ignore, ...rest } = r;
        return rest;
      });

      await bulkImport(cleaned as Partial<PlaylistScene>[]);
    } catch (error: any) {
      console.error('Scene import error:', error);
      toast.error(`Ошибка импорта сцен: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const sceneCountByAdvisor = (advisorId: string): number => {
    return scenes.filter(s => s.advisor_id === advisorId).length;
  };

  const approvedCountByAdvisor = (advisorId: string): number => {
    return scenes.filter(s => s.advisor_id === advisorId && s.status === 'approved').length;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {advisors.length} духовников × {playlists.length} плейлистов = {advisors.length * playlists.length} сцен
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Импорт CSV
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Развернуть все
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Свернуть все
          </Button>
        </div>
      </div>

      {/* Advisors list with nested playlists */}
      <div className="space-y-2">
        {advisors.map(advisor => {
          const isExpanded = expandedAdvisors.has(advisor.id);
          const approvedScenes = approvedCountByAdvisor(advisor.id);

          return (
            <Card key={advisor.id} className="glass-card overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleAdvisor(advisor.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        {advisor.photos?.[0]?.photo_url ? (
                          <img
                            src={advisor.photos[0].photo_url}
                            alt={advisor.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Image className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {advisor.display_name || advisor.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {approvedScenes}/{playlists.length} сцен готово
                          </p>
                        </div>
                      </div>
                      <Badge variant={approvedScenes === playlists.length ? 'default' : 'outline'}>
                        {approvedScenes === playlists.length ? 'Все готово' : `${approvedScenes}/${playlists.length}`}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 px-4 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Плейлист</TableHead>
                          <TableHead className="w-32">Статус</TableHead>
                          <TableHead className="w-32">Проверка</TableHead>
                          <TableHead className="w-24">Сцена</TableHead>
                          <TableHead className="w-40">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playlists.map(playlist => {
                          const scene = getScene(playlist.id, advisor.id);
                          const isGenerating = generatingScenes.has(`${playlist.id}-${advisor.id}`);
                          const status = statusLabels[scene?.status || 'waiting'] || statusLabels.waiting;
                          const reviewStatus = reviewStatusLabels[scene?.review_status || 'Waiting'] || reviewStatusLabels.Waiting;

                          return (
                            <TableRow 
                              key={playlist.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => scene 
                                ? handleOpenScene(scene, playlist, advisor) 
                                : handleCreateAndOpenScene(playlist, advisor)
                              }
                            >
                              <TableCell>
                                <div className="font-medium">{playlist.name}</div>
                                {playlist.description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                                    {playlist.description}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={reviewStatus.variant}>
                                  {reviewStatus.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {scene?.scene_url ? (
                                  <img
                                    src={scene.scene_url}
                                    alt="Scene"
                                    className="w-12 h-16 object-cover rounded border"
                                  />
                                ) : (
                                  <div className="w-12 h-16 bg-muted rounded border flex items-center justify-center">
                                    <Image className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isGenerating}
                                    onClick={() => handleGenerateScene(playlist, advisor)}
                                  >
                                    {isGenerating ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Wand2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                  {scene && scene.status !== 'approved' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-600"
                                      onClick={() => handleUpdateScene(scene.id, { status: 'approved' })}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {scene && scene.status !== 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600"
                                      onClick={() => handleUpdateScene(scene.id, { status: 'cancelled' })}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Side Panel */}
      <SceneSidePanel
        scene={selectedScene}
        playlist={selectedPlaylist}
        advisor={selectedAdvisor}
        open={showSidePanel}
        onOpenChange={setShowSidePanel}
        onUpdateScene={handleUpdateScene}
      />

      {/* CSV Importer */}
      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт сцен из CSV"
        columnMapping={SCENE_COLUMN_MAPPING}
        previewColumns={SCENE_PREVIEW_COLUMNS}
        onImport={handleImport}
        lookups={{ advisors, playlists }}
        resolveRow={resolveRow}
        fieldDefinitions={SCENE_FIELD_DEFINITIONS}
      />
    </div>
  );
}
