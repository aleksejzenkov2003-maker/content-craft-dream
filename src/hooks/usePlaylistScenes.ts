import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlaylistScene {
  id: string;
  playlist_id: string | null;
  advisor_id: string | null;
  scene_prompt: string | null;
  scene_url: string | null;
  status: string;
  review_status: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  playlist?: {
    id: string;
    name: string;
  };
  advisor?: {
    id: string;
    name: string;
    display_name: string | null;
  };
}

export interface SceneVariant {
  id: string;
  scene_id: string;
  image_url: string;
  prompt_used: string | null;
  is_selected: boolean;
  created_at: string;
}

export function usePlaylistScenes() {
  const [scenes, setScenes] = useState<PlaylistScene[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScenes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('playlist_scenes')
        .select(`
          *,
          playlist:playlists (id, name),
          advisor:advisors (id, name, display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenes(data || []);
    } catch (error: any) {
      console.error('Error fetching playlist scenes:', error);
      toast.error('Ошибка загрузки сцен');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  const addScene = async (data: Partial<PlaylistScene>) => {
    try {
      const { data: newScene, error } = await supabase
        .from('playlist_scenes')
        .insert(data)
        .select(`
          *,
          playlist:playlists (id, name),
          advisor:advisors (id, name, display_name)
        `)
        .single();

      if (error) throw error;

      await fetchScenes();
      toast.success('Сцена создана');
      return newScene;
    } catch (error: any) {
      console.error('Error adding scene:', error);
      toast.error('Ошибка создания сцены');
      throw error;
    }
  };

  const updateScene = async (id: string, updates: Partial<PlaylistScene>) => {
    try {
      const { error } = await supabase
        .from('playlist_scenes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchScenes();
    } catch (error: any) {
      console.error('Error updating scene:', error);
      toast.error('Ошибка обновления сцены');
      throw error;
    }
  };

  const deleteScene = async (id: string) => {
    try {
      const { error } = await supabase
        .from('playlist_scenes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchScenes();
      toast.success('Сцена удалена');
    } catch (error: any) {
      console.error('Error deleting scene:', error);
      toast.error('Ошибка удаления сцены');
      throw error;
    }
  };

  const bulkImport = async (items: Partial<PlaylistScene>[]) => {
    try {
      const { error } = await supabase
        .from('playlist_scenes')
        .insert(items.map(item => ({
          playlist_id: item.playlist_id || null,
          advisor_id: item.advisor_id || null,
          scene_prompt: item.scene_prompt || null,
          scene_url: item.scene_url || null,
          status: item.status || 'waiting',
          review_status: item.review_status || 'Waiting',
        })));

      if (error) throw error;

      await fetchScenes();
      toast.success(`Импортировано ${items.length} сцен`);
    } catch (error: any) {
      console.error('Error bulk importing scenes:', error);
      toast.error('Ошибка импорта сцен');
      throw error;
    }
  };

  const fetchVariants = async (sceneId: string): Promise<SceneVariant[]> => {
    try {
      const { data, error } = await supabase
        .from('scene_variants')
        .select('*')
        .eq('scene_id', sceneId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as SceneVariant[];
    } catch (error: any) {
      console.error('Error fetching variants:', error);
      return [];
    }
  };

  const selectVariant = async (variantId: string, sceneId: string) => {
    try {
      // Deselect all variants for this scene
      await supabase
        .from('scene_variants')
        .update({ is_selected: false })
        .eq('scene_id', sceneId);

      // Select the chosen variant
      const { data: variant, error: selectError } = await supabase
        .from('scene_variants')
        .update({ is_selected: true })
        .eq('id', variantId)
        .select()
        .single();

      if (selectError) throw selectError;

      // Update scene_url on the main scene record
      await supabase
        .from('playlist_scenes')
        .update({ scene_url: (variant as SceneVariant).image_url })
        .eq('id', sceneId);

      await fetchScenes();
      toast.success('Вариант выбран');
    } catch (error: any) {
      console.error('Error selecting variant:', error);
      toast.error('Ошибка выбора варианта');
    }
  };

  return {
    scenes,
    loading,
    refetch: fetchScenes,
    addScene,
    updateScene,
    deleteScene,
    bulkImport,
    fetchVariants,
    selectVariant,
  };
}
