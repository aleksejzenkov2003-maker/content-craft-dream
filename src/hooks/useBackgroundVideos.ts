import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BackgroundVideo {
  id: string;
  media_url: string;
  media_type: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundAssignment {
  id: string;
  background_id: string;
  playlist_id: string | null;
  advisor_id: string | null;
  created_at: string;
}

export function useBackgroundVideos() {
  const [backgrounds, setBackgrounds] = useState<BackgroundVideo[]>([]);
  const [assignments, setAssignments] = useState<BackgroundAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackgrounds = useCallback(async () => {
    try {
      setLoading(true);
      const [bgRes, asRes] = await Promise.all([
        (supabase.from('background_videos' as any) as any).select('*').order('created_at', { ascending: false }),
        (supabase.from('background_assignments' as any) as any).select('*'),
      ]);
      if (bgRes.error) throw bgRes.error;
      if (asRes.error) throw asRes.error;
      setBackgrounds(bgRes.data || []);
      setAssignments(asRes.data || []);
    } catch (error: any) {
      console.error('Error fetching backgrounds:', error);
      toast.error('Ошибка загрузки подложек');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackgrounds(); }, [fetchBackgrounds]);

  const addBackground = async (data: { media_url: string; media_type?: string; title?: string }) => {
    try {
      const { error } = await (supabase.from('background_videos' as any) as any).insert({
        media_url: data.media_url,
        media_type: data.media_type || 'video',
        title: data.title || null,
      });
      if (error) throw error;
      await fetchBackgrounds();
      toast.success('Подложка добавлена');
    } catch (error: any) {
      console.error('Error adding background:', error);
      toast.error('Ошибка добавления подложки');
      throw error;
    }
  };

  const updateBackground = async (id: string, data: { title?: string; media_url?: string; media_type?: string }) => {
    try {
      const { error } = await (supabase.from('background_videos' as any) as any).update(data).eq('id', id);
      if (error) throw error;
      await fetchBackgrounds();
      toast.success('Подложка обновлена');
    } catch (error: any) {
      console.error('Error updating background:', error);
      toast.error('Ошибка обновления подложки');
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

  const saveAssignments = async (backgroundId: string, pairs: { playlist_id: string; advisor_id: string }[]) => {
    try {
      // Delete existing assignments for this background
      const { error: deleteError } = await (supabase.from('background_assignments' as any) as any).delete().eq('background_id', backgroundId);
      if (deleteError) throw deleteError;
      // Insert new ones in chunks of 50 to avoid payload limits
      if (pairs.length > 0) {
        const rows = pairs.map(p => ({ background_id: backgroundId, playlist_id: p.playlist_id, advisor_id: p.advisor_id }));
        const CHUNK_SIZE = 50;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await (supabase.from('background_assignments' as any) as any).insert(chunk);
          if (error) throw error;
        }
      }
      await fetchBackgrounds();
      toast.success('Назначения сохранены');
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast.error('Ошибка сохранения назначений');
      throw error;
    }
  };

  const getBackgroundForPair = (playlistId: string, advisorId: string): BackgroundVideo | null => {
    const assignment = assignments.find(a => a.playlist_id === playlistId && a.advisor_id === advisorId);
    if (!assignment) return null;
    return backgrounds.find(b => b.id === assignment.background_id) || null;
  };

  return {
    backgrounds,
    assignments,
    loading,
    refetch: fetchBackgrounds,
    addBackground,
    updateBackground,
    deleteBackground,
    saveAssignments,
    getBackgroundForPair,
  };
}
