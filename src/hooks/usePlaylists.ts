import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  video_count: number;
  scene_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .order('name');

      if (error) throw error;

      setPlaylists(data || []);
    } catch (error: any) {
      console.error('Error fetching playlists:', error);
      toast.error('Ошибка загрузки плейлистов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const addPlaylist = async (data: { name: string; description?: string }) => {
    try {
      const { data: newPlaylist, error } = await supabase
        .from('playlists')
        .insert({
          name: data.name,
          description: data.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchPlaylists();
      toast.success('Плейлист создан');
      return newPlaylist;
    } catch (error: any) {
      console.error('Error adding playlist:', error);
      toast.error('Ошибка создания плейлиста');
      throw error;
    }
  };

  const updatePlaylist = async (id: string, updates: Partial<Playlist>) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchPlaylists();
      toast.success('Плейлист обновлён');
    } catch (error: any) {
      console.error('Error updating playlist:', error);
      toast.error('Ошибка обновления плейлиста');
      throw error;
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchPlaylists();
      toast.success('Плейлист удалён');
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      toast.error('Ошибка удаления плейлиста');
      throw error;
    }
  };

  const bulkImport = async (items: Partial<Playlist>[]) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .upsert(items.map(item => ({
          name: item.name!,
          description: item.description || null,
          scene_prompt: item.scene_prompt || null,
        })), { onConflict: 'name' });

      if (error) throw error;

      await fetchPlaylists();
      toast.success(`Импортировано ${items.length} плейлистов`);
    } catch (error: any) {
      console.error('Error bulk importing playlists:', error);
      toast.error('Ошибка импорта плейлистов');
      throw error;
    }
  };

  return {
    playlists,
    loading,
    refetch: fetchPlaylists,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    bulkImport,
  };
}
