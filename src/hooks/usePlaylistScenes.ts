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
  motion_type: string | null;
  motion_prompt: string | null;
  motion_avatar_id: string | null;
  created_at: string;
  updated_at: string;
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

const SCENE_SELECT = `
  *,
  playlist:playlists (id, name),
  advisor:advisors (id, name, display_name)
`;

export function usePlaylistScenes() {
  const [scenes, setScenes] = useState<PlaylistScene[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScenes = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from('playlist_scenes')
        .select(SCENE_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenes((data || []) as PlaylistScene[]);
    } catch (error: any) {
      console.error('Error fetching playlist scenes:', error);
      if (!silent) {
        toast.error('Ошибка загрузки сцен');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  useEffect(() => {
    const channel = supabase
      .channel('playlist-senes-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_scenes',
        },
        () => {
          void fetchScenes(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchScenes]);

  const addScene = async (data: Partial<PlaylistScene>) => {
    try {
      const { data: newScene, error } = await supabase
        .from('playlist_scenes')
        .insert(data)
        .select(SCENE_SELECT)
        .single();

      if (error) throw error;

      await fetchScenes(true);
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

      await fetchScenes(true);
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

      await fetchScenes(true);
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

      await fetchScenes(true);
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
      await supabase
        .from('scene_variants')
        .update({ is_selected: false })
        .eq('scene_id', sceneId);

      const { data: variant, error: selectError } = await supabase
        .from('scene_variants')
        .update({ is_selected: true })
        .eq('id', variantId)
        .select()
        .single();

      if (selectError) throw selectError;

      await supabase
        .from('playlist_scenes')
        .update({
          scene_url: (variant as SceneVariant).image_url,
        })
        .eq('id', sceneId);

      await fetchScenes(true);
      toast.success('Вариант выбран');
    } catch (error: any) {
      console.error('Error selecting variant:', error);
      toast.error('Ошибка выбора варианта');
    }
  };

  const deleteVariant = async (variantId: string, sceneId: string) => {
    try {
      const { data: variant } = await supabase
        .from('scene_variants')
        .select('is_selected, image_url')
        .eq('id', variantId)
        .single();

      await supabase.from('scene_variants').delete().eq('id', variantId);

      // If deleted variant was selected, select the latest remaining or clear
      if ((variant as any)?.is_selected) {
        const remaining = await fetchVariants(sceneId);
        if (remaining.length > 0) {
          const last = remaining[remaining.length - 1];
          await selectVariant(last.id, sceneId);
        } else {
          await supabase.from('playlist_scenes').update({ scene_url: null, status: 'waiting' }).eq('id', sceneId);
          await fetchScenes(true);
        }
      }

      toast.success('Вариант удалён');
    } catch (error: any) {
      console.error('Error deleting variant:', error);
      toast.error('Ошибка удаления варианта');
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
    deleteVariant,
  };
}
