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

// Normalize various status values to canonical ones
const normalizeStatus = (status: string | null | undefined): string => {
  if (!status) return 'waiting';
  const lower = status.toLowerCase().trim();
  if (['approved', 'одобрено', 'сцена готова', 'готово', 'ready', 'done'].includes(lower)) return 'approved';
  if (['generating', 'генерация', 'in_progress'].includes(lower)) return 'generating';
  if (['cancelled', 'отменено', 'rejected', 'отклонено'].includes(lower)) return 'cancelled';
  return 'waiting';
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  waiting: { label: 'Ожидает', variant: 'outline' },
  generating: { label: 'Генерация', variant: 'secondary' },
  approved: { label: 'Одобрено', variant: 'default' },
  cancelled: { label: 'Отменено', variant: 'destructive' },
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
    // scenes are ordered by created_at DESC (newest first)
    // For duplicate playlist+advisor combos, keep the best one:
    // priority: approved with URL > approved > generating > waiting
    const priority = (s: PlaylistScene): number => {
      const status = normalizeStatus(s.status);
      if (status === 'approved' && s.scene_url) return 4;
      if (status === 'approved') return 3;
      if (status === 'generating') return 2;
      return 1;
    };
    scenes.forEach(scene => {
      if (scene.playlist_id && scene.advisor_id) {
        const key = `${scene.playlist_id}-${scene.advisor_id}`;
        const existing = map.get(key);
        if (!existing || priority(scene) > priority(existing)) {
          map.set(key, scene);
        }
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
      const response = await supabase.functions.invoke('generate-scene', {
        body: {
          playlistId: playlist.id,
          advisorId: advisor.id,
          prompt: playlist.scene_prompt || `Professional scene for ${playlist.name}`,
        },
      });

      if (response.error) throw response.error;
      
      const result = response.data;
      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.sceneUrl) {
        toast.success('Сцена сгенерирована!');
      } else {
        toast.warning('Функция завершилась, но изображение не получено');
      }
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
    let count = 0;
    playlists.forEach(p => {
      const scene = sceneMap.get(`${p.id}-${advisorId}`);
      if (scene && normalizeStatus(scene.status) === 'approved') count++;
    });
    return count;
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
      <div className="space-y-6">
        {advisors.map(advisor => {
          const isExpanded = expandedAdvisors.has(advisor.id);
          const approvedScenes = approvedCountByAdvisor(advisor.id);

          return (
            <div key={advisor.id}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleAdvisor(advisor.id)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer py-2 group">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    {advisor.photos?.[0]?.photo_url ? (
                      <img
                        src={advisor.photos[0].photo_url}
                        alt={advisor.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Image className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="text-lg font-semibold">
                        {advisor.display_name || advisor.name}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {approvedScenes}/{playlists.length} сцен готово
                      </p>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-8 mt-1">
                    {/* Column headers */}
                    <div className="flex items-center py-2 text-sm font-medium text-muted-foreground border-b">
                      <div className="flex-1" />
                      <div className="w-28 text-center">Статус</div>
                      <div className="w-20 text-center">Сцена</div>
                      <div className="w-36 text-right">Действия</div>
                    </div>
                    {playlists.map(playlist => {
                      const scene = getScene(playlist.id, advisor.id);
                      const isGenerating = generatingScenes.has(`${playlist.id}-${advisor.id}`);
                      const sceneStatus = normalizeStatus(scene?.status);

                      const statusText = sceneStatus === 'approved' ? 'ГОТОВО' : sceneStatus === 'generating' ? 'генерация' : 'ожидает';
                      const statusColor = sceneStatus === 'approved' 
                        ? 'text-orange-600 font-bold uppercase' 
                        : sceneStatus === 'generating' 
                          ? 'text-yellow-600' 
                          : 'text-muted-foreground';

                      return (
                        <div
                          key={playlist.id}
                          className="flex items-center py-2 border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => scene 
                            ? handleOpenScene(scene, playlist, advisor) 
                            : handleCreateAndOpenScene(playlist, advisor)
                          }
                        >
                          <div className="flex-1 pl-4 text-sm">
                            {playlist.name}
                          </div>
                          <div className={`w-28 text-center text-sm ${statusColor}`}>
                            {statusText}
                          </div>
                          <div className="w-20 flex justify-center">
                            {scene?.scene_url ? (
                              <img
                                src={scene.scene_url}
                                alt="Scene"
                                className="w-8 h-8 rounded-full object-cover border"
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                          <div className="w-36 flex justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              disabled={isGenerating}
                              onClick={() => handleGenerateScene(playlist, advisor)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-full px-4 h-7"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : null}
                              Сгенерировать
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
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
