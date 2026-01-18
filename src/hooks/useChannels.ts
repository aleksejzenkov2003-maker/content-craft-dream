import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentSource } from '@/types/content';

export interface DbChannel {
  id: string;
  name: string;
  url: string;
  source: ContentSource;
  is_active: boolean;
  posts_count: number;
  last_parsed_at: string | null;
  created_at: string;
}

export function useChannels() {
  const [channels, setChannels] = useState<DbChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error: unknown) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить источники',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const addChannel = async (channel: { name: string; url: string; source: ContentSource }) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name: channel.name,
          url: channel.url,
          source: channel.source,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      setChannels(prev => [data, ...prev]);
      toast({
        title: 'Источник добавлен',
        description: channel.name
      });
      
      return data;
    } catch (error: unknown) {
      console.error('Error adding channel:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить источник',
        variant: 'destructive'
      });
    }
  };

  const toggleChannel = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('channels')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setChannels(prev => prev.map(c => 
        c.id === id ? { ...c, is_active: isActive } : c
      ));
    } catch (error: unknown) {
      console.error('Error toggling channel:', error);
    }
  };

  const removeChannel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setChannels(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Источник удален'
      });
    } catch (error: unknown) {
      console.error('Error removing channel:', error);
    }
  };

  const parseChannel = async (id: string, daysBack: number = 30) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return { success: false, items: [], duplicatesSkipped: 0 };

    toast({
      title: 'Парсинг запущен',
      description: `${channel.name} (${daysBack} дней)`
    });

    try {
      const { data, error } = await supabase.functions.invoke('parse-content', {
        body: {
          channelId: id,
          url: channel.url,
          source: channel.source,
          daysBack
        }
      });

      if (error) throw error;

      if (data?.success) {
        const newCount = data.count || 0;
        const duplicatesSkipped = data.duplicatesSkipped || 0;
        
        toast({
          title: 'Парсинг завершен',
          description: newCount > 0 
            ? `Добавлено ${newCount} постов${duplicatesSkipped > 0 ? `, ${duplicatesSkipped} дубликатов пропущено` : ''}`
            : duplicatesSkipped > 0 
              ? `Все ${duplicatesSkipped} постов уже существуют`
              : 'Новых постов не найдено'
        });
        
        // Update channel in state
        setChannels(prev => prev.map(c => 
          c.id === id ? { 
            ...c, 
            last_parsed_at: new Date().toISOString(),
            posts_count: (c.posts_count || 0) + newCount
          } : c
        ));
        
        return { 
          success: true, 
          items: data.items || [], 
          duplicatesSkipped 
        };
      } else {
        throw new Error(data?.error || 'Parse failed');
      }
    } catch (error: unknown) {
      console.error('Parse error:', error);
      toast({
        title: 'Ошибка парсинга',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      return { success: false, items: [], duplicatesSkipped: 0 };
    }
  };

  const parseAllBySource = async (source: ContentSource, daysBack: number = 30) => {
    const sourceChannels = channels.filter(c => c.source === source && c.is_active);
    
    toast({
      title: 'Парсинг запущен',
      description: `${sourceChannels.length} источников (${daysBack} дней)`
    });

    for (const channel of sourceChannels) {
      await parseChannel(channel.id, daysBack);
    }
  };

  return {
    channels,
    loading,
    addChannel,
    toggleChannel,
    removeChannel,
    parseChannel,
    parseAllBySource,
    refetch: fetchChannels
  };
}
