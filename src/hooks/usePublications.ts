import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Publication {
  id: string;
  video_id: string | null;
  channel_id: string | null;
  post_date: string | null;
  post_url: string | null;
  generated_text: string | null;
  publication_status: string;
  views: number;
  likes: number;
  followers: number;
  reach: number;
  profile_views: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  video?: {
    id: string;
    video_title: string | null;
    question: string | null;
    advisor_id: string | null;
  };
  channel?: {
    id: string;
    name: string;
    network_type: string;
  };
}

export interface PublicationFilters {
  channelId?: string;
  videoId?: string;
  status?: string;
}

export function usePublications(filters?: PublicationFilters) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublications = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('publications')
        .select(`
          *,
          video:videos (id, video_title, question, advisor_id),
          channel:publishing_channels (id, name, network_type)
        `)
        .order('post_date', { ascending: false, nullsFirst: false });

      if (filters?.channelId) {
        query = query.eq('channel_id', filters.channelId);
      }
      if (filters?.videoId) {
        query = query.eq('video_id', filters.videoId);
      }
      if (filters?.status) {
        query = query.eq('publication_status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPublications(data || []);
    } catch (error: any) {
      console.error('Error fetching publications:', error);
      toast.error('Ошибка загрузки публикаций');
    } finally {
      setLoading(false);
    }
  }, [filters?.channelId, filters?.videoId, filters?.status]);

  useEffect(() => {
    fetchPublications();
  }, [fetchPublications]);

  const addPublication = async (data: Partial<Publication>) => {
    try {
      const { error } = await supabase
        .from('publications')
        .insert(data);

      if (error) throw error;

      await fetchPublications();
      toast.success('Публикация создана');
    } catch (error: any) {
      console.error('Error adding publication:', error);
      toast.error('Ошибка создания публикации');
      throw error;
    }
  };

  const updatePublication = async (id: string, updates: Partial<Publication>) => {
    try {
      const { error } = await supabase
        .from('publications')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchPublications();
      toast.success('Публикация обновлена');
    } catch (error: any) {
      console.error('Error updating publication:', error);
      toast.error('Ошибка обновления публикации');
      throw error;
    }
  };

  const deletePublication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('publications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchPublications();
      toast.success('Публикация удалена');
    } catch (error: any) {
      console.error('Error deleting publication:', error);
      toast.error('Ошибка удаления публикации');
      throw error;
    }
  };

  return {
    publications,
    loading,
    refetch: fetchPublications,
    addPublication,
    updatePublication,
    deletePublication,
  };
}
