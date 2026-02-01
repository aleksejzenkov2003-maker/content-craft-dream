import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Video {
  id: string;
  video_number: number | null;
  question_id: number | null;
  advisor_id: string | null;
  playlist_id: string | null;
  safety_score: string | null;
  hook: string | null;
  question: string | null;
  answer_prompt: string | null;
  advisor_answer: string | null;
  answer_status: string | null;
  video_title: string | null;
  cover_prompt: string | null;
  main_photo_url: string | null;
  cover_url: string | null;
  generation_status: string | null;
  video_path: string | null;
  heygen_video_id: string | null;
  heygen_video_url: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  pinterest_url: string | null;
  reddit_url: string | null;
  created_at: string;
  updated_at: string;
  // Cover and reel fields
  cover_status: string | null;
  front_cover_url: string | null;
  back_cover_url: string | null;
  video_duration: number | null;
  reel_status: string | null;
  publication_date: string | null;
  // New fields from migration
  question_rus: string | null;
  question_eng: string | null;
  hook_rus: string | null;
  relevance_score: number | null;
  question_status: string | null;
  voiceover_url: string | null;
  // Joined data
  advisor?: {
    id: string;
    name: string;
    display_name: string | null;
  };
  playlist?: {
    id: string;
    name: string;
  };
}

export interface VideoFilters {
  advisorId?: string;
  playlistId?: string;
  status?: string;
  search?: string;
  questionId?: number;
  questionIds?: number[];
}

export function useVideos(filters?: VideoFilters) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('videos')
        .select(`
          *,
          advisor:advisors (id, name, display_name),
          playlist:playlists (id, name)
        `)
        .order('video_number', { ascending: true, nullsFirst: false });

      if (filters?.advisorId) {
        query = query.eq('advisor_id', filters.advisorId);
      }
      if (filters?.playlistId) {
        query = query.eq('playlist_id', filters.playlistId);
      }
      if (filters?.status) {
        query = query.eq('generation_status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`video_title.ilike.%${filters.search}%,question.ilike.%${filters.search}%,hook.ilike.%${filters.search}%`);
      }
      if (filters?.questionIds && filters.questionIds.length > 0) {
        query = query.in('question_id', filters.questionIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setVideos(data || []);
    } catch (error: any) {
      console.error('Error fetching videos:', error);
      toast.error('Ошибка загрузки роликов');
    } finally {
      setLoading(false);
    }
  }, [filters?.advisorId, filters?.playlistId, filters?.status, filters?.search, filters?.questionIds]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const addVideo = async (data: Partial<Video>) => {
    try {
      const { data: newVideo, error } = await supabase
        .from('videos')
        .insert(data)
        .select(`
          *,
          advisor:advisors (id, name, display_name),
          playlist:playlists (id, name)
        `)
        .single();

      if (error) throw error;

      await fetchVideos();
      toast.success('Ролик добавлен');
      return newVideo;
    } catch (error: any) {
      console.error('Error adding video:', error);
      toast.error('Ошибка добавления ролика');
      throw error;
    }
  };

  const updateVideo = async (id: string, updates: Partial<Video>, options?: { silent?: boolean }) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchVideos();
      if (!options?.silent) {
        toast.success('Ролик обновлён');
      }
    } catch (error: any) {
      console.error('Error updating video:', error);
      toast.error('Ошибка обновления ролика');
      throw error;
    }
  };

  const deleteVideo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchVideos();
      toast.success('Ролик удалён');
    } catch (error: any) {
      console.error('Error deleting video:', error);
      toast.error('Ошибка удаления ролика');
      throw error;
    }
  };

  const bulkImport = async (videosData: Partial<Video>[]) => {
    try {
      const { error } = await supabase
        .from('videos')
        .insert(videosData);

      if (error) throw error;

      await fetchVideos();
      toast.success(`Импортировано ${videosData.length} роликов`);
    } catch (error: any) {
      console.error('Error importing videos:', error);
      toast.error('Ошибка импорта роликов');
      throw error;
    }
  };

  return {
    videos,
    loading,
    refetch: fetchVideos,
    addVideo,
    updateVideo,
    deleteVideo,
    bulkImport,
  };
}
