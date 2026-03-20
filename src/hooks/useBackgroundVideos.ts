import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BackgroundVideo {
  id: string;
  playlist_id: string | null;
  advisor_id: string | null;
  video_url: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function useBackgroundVideos() {
  const [backgrounds, setBackgrounds] = useState<BackgroundVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackgrounds = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('background_videos' as any) as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBackgrounds(data || []);
    } catch (error: any) {
      console.error('Error fetching background videos:', error);
      toast.error('Ошибка загрузки фоновых подложек');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackgrounds(); }, [fetchBackgrounds]);

  const addBackground = async (data: { playlist_id?: string; advisor_id?: string; video_url: string; title?: string }) => {
    try {
      const { error } = await (supabase.from('background_videos' as any) as any).insert(data);
      if (error) throw error;
      await fetchBackgrounds();
      toast.success('Подложка добавлена');
    } catch (error: any) {
      console.error('Error adding background:', error);
      toast.error('Ошибка добавления подложки');
      throw error;
    }
  };

  const deleteBackground = async (id: string) => {
    try {
      const { error } = await (supabase.from('background_videos' as any) as any).delete().eq('id', id);
      if (error) throw error;
      await fetchBackgrounds();
      toast.success('Подложка удалена');
    } catch (error: any) {
      console.error('Error deleting background:', error);
      toast.error('Ошибка удаления подложки');
      throw error;
    }
  };

  return { backgrounds, loading, refetch: fetchBackgrounds, addBackground, deleteBackground };
}
