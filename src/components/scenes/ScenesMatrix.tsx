import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronRight, ChevronDown, Image, Wand2, Check, X, FileSpreadsheet, Sparkles } from 'lucide-react';
import { usePlaylistScenes, PlaylistScene } from '@/hooks/usePlaylistScenes';
import { useAdvisors, Advisor } from '@/hooks/useAdvisors';
import { usePlaylists, Playlist } from '@/hooks/usePlaylists';
import { SceneSidePanel } from './SceneSidePanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CsvImporter, Lookups } from '@/components/import/CsvImporter';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { SCENE_COLUMN_MAPPING, SCENE_PREVIEW_COLUMNS, SCENE_FIELD_DEFINITIONS } from '@/components/import/importConfigs';

const PAIR_KEY_SEPARATOR = '::';
const getPairKey = (playlistId: string, advisorId: string) => `${playlistId}${PAIR_KEY_SEPARATOR}${advisorId}`;
const parsePairKey = (key: string) => {
  const [playlistId, advisorId] = key.split(PAIR_KEY_SEPARATOR);
  return { playlistId, advisorId };
};

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
  const { scenes, loading: scenesLoading, addScene, updateScene, refetch, bulkImport, fetchVariants, selectVariant } = usePlaylistScenes();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const { playlists, loading: playlistsLoading } = usePlaylists();
  
  const [expandedAdvisors, setExpandedAdvisors] = useState<Set<string>>(new Set());
  const [generatingScenes, setGeneratingScenes] = useState<Set<string>>(new Set());
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkMotioning, setBulkMotioning] = useState(false);
  const bulkCancelRef = useRef(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  const loading = scenesLoading || advisorsLoading || playlistsLoading;

  // Derive live objects from arrays
  const selectedScene = selectedSceneId ? (scenes.find(s => s.id === selectedSceneId) ?? null) : null;
  const selectedPlaylist = selectedPlaylistId ? (playlists.find(p => p.id === selectedPlaylistId) ?? null) : null;
  const selectedAdvisor = selectedAdvisorId ? (advisors.find(a => a.id === selectedAdvisorId) ?? null) : null;

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

  const togglePair = (playlistId: string, advisorId: string) => {
    const key = getPairKey(playlistId, advisorId);
    setSelectedPairs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllForAdvisor = (advisorId: string) => {
    const keys = playlists.map(p => getPairKey(p.id, advisorId));
    setSelectedPairs(prev => {
      const next = new Set(prev);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const isAllSelectedForAdvisor = (advisorId: string) =>
    playlists.length > 0 && playlists.every(p => selectedPairs.has(getPairKey(p.id, advisorId)));

  const isSomeSelectedForAdvisor = (advisorId: string) =>
    playlists.some(p => selectedPairs.has(getPairKey(p.id, advisorId)));

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

  const handleBulkGenerate = async () => {
    const pairs = Array.from(selectedPairs).map(key => {
      const [playlistId, advisorId] = key.split('-');
      return {
        playlist: playlists.find(p => p.id === playlistId)!,
        advisor: advisors.find(a => a.id === advisorId)!,
      };
    }).filter(p => p.playlist && p.advisor);

    if (pairs.length === 0) return;

    setBulkGenerating(true);
    bulkCancelRef.current = false;
    let success = 0;
    let failed = 0;

    for (const { playlist, advisor } of pairs) {
      if (bulkCancelRef.current) break;
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
        if (response.error || response.data?.error) {
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      } finally {
        setGeneratingScenes(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }

    await refetch();
    setSelectedPairs(new Set());
    setBulkGenerating(false);
    toast.success(`Генерация завершена: ${success} успешно${failed ? `, ${failed} с ошибкой` : ''}`);
  };

  

  const handleBulkAddMotion = async () => {
    // Get unique scene IDs for selected pairs that have approved scenes
    const sceneIds: { sceneId: string; key: string }[] = [];
    for (const key of selectedPairs) {
      const [playlistId, advisorId] = key.split('-');
      const scene = sceneMap.get(key);
      if (scene && normalizeStatus(scene.status) === 'approved' && scene.scene_url && !scene.motion_avatar_id) {
        sceneIds.push({ sceneId: scene.id, key });
      }
    }

    if (sceneIds.length === 0) {
      toast.error('Нет одобренных сцен без motion среди выбранных');
      return;
    }

    setBulkMotioning(true);
    let success = 0;
    let failed = 0;

    for (const { sceneId, key } of sceneIds) {
      if (bulkCancelRef.current) break;
      setGeneratingScenes(prev => new Set(prev).add(key));
      try {
        const { data, error } = await supabase.functions.invoke('add-avatar-motion', {
          body: {
            sceneId,
            motionType: 'consistent',
            motionPrompt: 'The person gestures naturally with their hands while explaining something',
          },
        });
        if (error || data?.error) {
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      } finally {
        setGeneratingScenes(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }

    await refetch();
    setSelectedPairs(new Set());
    setBulkMotioning(false);
    toast.success(`Motion: ${success} добавлено${failed ? `, ${failed} ошибок` : ''}`);
  };

  const handleOpenScene = (scene: PlaylistScene, playlist: Playlist, advisor: Advisor) => {
    setSelectedSceneId(scene.id);
    setSelectedPlaylistId(playlist.id);
    setSelectedAdvisorId(advisor.id);
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
        setSelectedSceneId(newScene.id);
        setSelectedPlaylistId(playlist.id);
        setSelectedAdvisorId(advisor.id);
        setShowSidePanel(true);
      }
    } catch (error) {
      console.error('Error creating scene:', error);
    }
  };

  const handleUpdateScene = async (id: string, updates: Partial<PlaylistScene>) => {
    await updateScene(id, updates);
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

      {/* Bulk Actions */}
      <BulkActionsBar
        selectedCount={selectedPairs.size}
        onClearSelection={() => setSelectedPairs(new Set())}
      >
        <BulkActionButton
          onClick={handleBulkGenerate}
          loading={bulkGenerating}
          disabled={bulkMotioning}
          icon={<Wand2 className="w-3 h-3" />}
          variant="default"
        >
          Сгенерировать {selectedPairs.size} сцен
        </BulkActionButton>
        <BulkActionButton
          onClick={handleBulkAddMotion}
          loading={bulkMotioning}
          disabled={bulkGenerating}
          icon={<Sparkles className="w-3 h-3" />}
          variant="secondary"
        >
          Добавить Motion
        </BulkActionButton>
      </BulkActionsBar>

      {/* Advisors list with nested playlists */}
      <div className="space-y-6">
        {advisors.map(advisor => {
          const isExpanded = expandedAdvisors.has(advisor.id);
          const approvedScenes = approvedCountByAdvisor(advisor.id);

          return (
            <div key={advisor.id}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleAdvisor(advisor.id)}>
                <div className="flex items-center gap-3 py-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isAllSelectedForAdvisor(advisor.id)}
                      data-indeterminate={!isAllSelectedForAdvisor(advisor.id) && isSomeSelectedForAdvisor(advisor.id)}
                      onCheckedChange={() => toggleAllForAdvisor(advisor.id)}
                    />
                  </div>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer flex-1 group">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      {(advisor.photos?.find(p => p.id === advisor.scene_photo_id) || advisor.photos?.[0])?.photo_url ? (
                        <img
                          src={(advisor.photos?.find(p => p.id === advisor.scene_photo_id) || advisor.photos?.[0])!.photo_url}
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
                </div>
                <CollapsibleContent>
                  <div className="ml-8 mt-1">
                    {/* Column headers */}
                    <div className="flex items-center py-2 text-sm font-medium text-muted-foreground border-b">
                      <div className="w-8" />
                      <div className="flex-1" />
                      <div className="w-28 text-center">Статус</div>
                      <div className="w-20 text-center">Сцена</div>
                      <div className="w-36 text-right">Действия</div>
                    </div>
                    {playlists.map(playlist => {
                      const scene = getScene(playlist.id, advisor.id);
                      const isGenerating = generatingScenes.has(`${playlist.id}-${advisor.id}`);
                      const sceneStatus = normalizeStatus(scene?.status);
                      const pairKey = `${playlist.id}-${advisor.id}`;

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
                          <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedPairs.has(pairKey)}
                              onCheckedChange={() => togglePair(playlist.id, advisor.id)}
                            />
                          </div>
                          <div className="flex-1 pl-2 text-sm">
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
        fetchVariants={fetchVariants}
        selectVariant={selectVariant}
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
