import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface PublishingChannel {
  id: string;
  name: string;
  network_type: string;
  proxy_server: string | null;
  location: string | null;
  api_credentials: Json | null;
  post_text_prompt: string | null;
  is_active: boolean;
  back_cover_url: string | null;
  back_cover_video_url: string | null;
  created_at: string;
  updated_at: string;
}

export function usePublishingChannels() {
  const [channels, setChannels] = useState<PublishingChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('publishing_channels')
        .select('*')
        .order('name');

      if (error) throw error;
      setChannels((data || []) as PublishingChannel[]);
    } catch (error: any) {
      console.error('Error fetching publishing channels:', error);
      toast.error('Ошибка загрузки каналов публикации');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const addChannel = async (data: Omit<Partial<PublishingChannel>, 'api_credentials'> & { api_credentials?: Json }) => {
    try {
      const { error } = await supabase
        .from('publishing_channels')
        .insert(data as any);

      if (error) throw error;

      await fetchChannels();
      toast.success('Канал добавлен');
    } catch (error: any) {
      console.error('Error adding channel:', error);
      toast.error('Ошибка добавления канала');
      throw error;
    }
  };

  const updateChannel = async (id: string, updates: Partial<PublishingChannel>) => {
    try {
      const { error } = await supabase
        .from('publishing_channels')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchChannels();
      toast.success('Канал обновлён');
    } catch (error: any) {
      console.error('Error updating channel:', error);
      toast.error('Ошибка обновления канала');
      throw error;
    }
  };

  const deleteChannel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('publishing_channels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchChannels();
      toast.success('Канал удалён');
    } catch (error: any) {
      console.error('Error deleting channel:', error);
      toast.error('Ошибка удаления канала');
      throw error;
    }
  };

  const bulkImport = async (items: Partial<PublishingChannel>[]) => {
    try {
      const { error } = await supabase
        .from('publishing_channels')
        .upsert(items.map(item => ({
          name: item.name!,
          network_type: item.network_type || 'instagram',
          proxy_server: item.proxy_server || null,
          location: item.location || null,
          post_text_prompt: item.post_text_prompt || null,
          is_active: item.is_active ?? true,
        })), { onConflict: 'name' });

      if (error) throw error;

      await fetchChannels();
      toast.success(`Импортировано ${items.length} каналов`);
    } catch (error: any) {
      console.error('Error bulk importing channels:', error);
      toast.error('Ошибка импорта каналов');
      throw error;
    }
  };

  return {
    channels,
    loading,
    refetch: fetchChannels,
    addChannel,
    updateChannel,
    deleteChannel,
    bulkImport,
  };
}
