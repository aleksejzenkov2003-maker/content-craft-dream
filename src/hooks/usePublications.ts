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
  final_video_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  video?: {
    id: string;
    video_title: string | null;
    question: string | null;
    advisor_id: string | null;
    video_number: number | null;
    video_duration: number | null;
    advisor?: {
      id: string;
      name: string;
      display_name: string | null;
    };
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
          video:videos (
            id, 
            video_title, 
            question, 
            advisor_id, 
            video_number, 
            video_duration,
            advisor:advisors (id, name, display_name)
          ),
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

  const addPublication = async (data: Partial<Publication>, autoGenerateText = true) => {
    try {
      // Дедубликация: проверяем существование пары video_id + channel_id
      if (data.video_id && data.channel_id) {
        const { data: existing } = await supabase
          .from('publications')
          .select('id')
          .eq('video_id', data.video_id)
          .eq('channel_id', data.channel_id)
          .maybeSingle();

        if (existing) {
          toast.warning('Публикация для этого ролика и канала уже существует');
          return existing.id;
        }
      }

      const { data: inserted, error } = await supabase
        .from('publications')
        .insert(data)
        .select('id')
        .single();

      if (error) throw error;

      // Автогенерация текста при создании публикации
      if (autoGenerateText && inserted?.id) {
        try {
          await supabase.functions.invoke('generate-post-text', {
            body: { publicationId: inserted.id },
          });
        } catch (e) {
          console.error('Auto-generate text failed:', e);
          // Не блокируем создание публикации при ошибке генерации
        }
      }

      await fetchPublications();
      toast.success('Публикация создана');
      return inserted?.id;
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

  const generateText = async (publicationId: string) => {
    try {
      const publication = publications.find(p => p.id === publicationId);
      if (!publication) throw new Error('Publication not found');

      const response = await supabase.functions.invoke('generate-post-text', {
        body: { publicationId },
      });

      if (response.error) throw response.error;

      await fetchPublications();
      toast.success('Текст сгенерирован');
      return response.data;
    } catch (error: any) {
      console.error('Error generating text:', error);
      toast.error('Ошибка генерации текста');
      throw error;
    }
  };

  const bulkImport = async (items: Partial<Publication>[]) => {
    try {
      // Фильтруем дубликаты по video_id + channel_id
      const existingPairs = new Set(
        publications
          .filter(p => p.video_id && p.channel_id)
          .map(p => `${p.video_id}_${p.channel_id}`)
      );

      const newItems = items.filter(item => {
        if (!item.video_id || !item.channel_id) return true;
        const key = `${item.video_id}_${item.channel_id}`;
        return !existingPairs.has(key);
      });

      const skippedCount = items.length - newItems.length;

      if (newItems.length === 0) {
        toast.info('Все публикации уже существуют');
        return;
      }

      const { error } = await supabase
        .from('publications')
        .insert(newItems.map(item => ({
          video_id: item.video_id || null,
          channel_id: item.channel_id || null,
          post_date: item.post_date || null,
          publication_status: item.publication_status || 'pending',
          post_url: item.post_url || null,
        })));

      if (error) throw error;

      await fetchPublications();
      if (skippedCount > 0) {
        toast.success(`Импортировано ${newItems.length}, пропущено дубликатов: ${skippedCount}`);
      } else {
        toast.success(`Импортировано ${newItems.length} публикаций`);
      }
    } catch (error: any) {
      console.error('Error bulk importing publications:', error);
      toast.error('Ошибка импорта публикаций');
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
    generateText,
    bulkImport,
  };
}
