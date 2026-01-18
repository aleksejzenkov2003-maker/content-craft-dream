import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DbParsedContent {
  id: string;
  channel_id: string | null;
  title: string;
  content: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_score: number | null;
  relevance_score: number | null;
  matched_keywords: string[] | null;
  published_at: string | null;
  parsed_at: string;
  status: 'parsed' | 'selected' | 'rewriting' | 'rewritten' | 'voiceover' | 'video' | 'published';
  created_at: string;
  channels?: {
    name: string;
    source: string;
  } | null;
}

export function useParsedContent() {
  const [content, setContent] = useState<DbParsedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('parsed_content')
        .select(`
          id,
          channel_id,
          title,
          content,
          original_url,
          thumbnail_url,
          views,
          likes,
          comments,
          engagement_score,
          relevance_score,
          matched_keywords,
          published_at,
          parsed_at,
          status,
          created_at,
          channels (name, source)
        `)
        .order('parsed_at', { ascending: false });

      if (error) throw error;
      setContent((data || []) as DbParsedContent[]);
    } catch (error: unknown) {
      console.error('Error fetching content:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить контент',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const rewriteContent = async (contentId: string, promptId?: string) => {
    const item = content.find(c => c.id === contentId);
    
    toast({
      title: 'Рерайт запущен',
      description: item?.title.substring(0, 50)
    });

    try {
      const { data, error } = await supabase.functions.invoke('rewrite-content', {
        body: { contentId, promptId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Рерайт завершен',
          description: 'Скрипт создан'
        });
        
        setContent(prev => prev.map(c => 
          c.id === contentId ? { ...c, status: 'rewritten' as const } : c
        ));
        
        return data.data;
      } else {
        throw new Error(data?.error || 'Rewrite failed');
      }
    } catch (error: unknown) {
      console.error('Rewrite error:', error);
      toast({
        title: 'Ошибка рерайта',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const deleteContent = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('parsed_content')
        .delete()
        .in('id', ids);

      if (error) throw error;
      
      setContent(prev => prev.filter(c => !ids.includes(c.id)));
      toast({
        title: 'Удалено',
        description: `${ids.length} элементов`
      });
    } catch (error: unknown) {
      console.error('Error deleting content:', error);
    }
  };

  const updateStatus = async (id: string, status: DbParsedContent['status']) => {
    try {
      const { error } = await supabase
        .from('parsed_content')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      setContent(prev => prev.map(c => 
        c.id === id ? { ...c, status } : c
      ));
    } catch (error: unknown) {
      console.error('Error updating status:', error);
    }
  };

  const clearAllContent = async () => {
    try {
      const { error } = await supabase
        .from('parsed_content')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      
      setContent([]);
      toast({
        title: 'Очищено',
        description: 'Весь контент удален'
      });
    } catch (error: unknown) {
      console.error('Error clearing content:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить контент',
        variant: 'destructive'
      });
    }
  };

  return {
    content,
    loading,
    rewriteContent,
    deleteContent,
    updateStatus,
    clearAllContent,
    refetch: fetchContent
  };
}
