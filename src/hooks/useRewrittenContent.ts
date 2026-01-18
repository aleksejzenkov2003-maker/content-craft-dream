import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RewrittenContentItem {
  id: string;
  rewritten_text: string;
  script: string | null;
  hook: string | null;
  cta: string | null;
  created_at: string;
  parsed_content_id: string | null;
  prompt_id: string | null;
  // Joined data
  parsed_content?: {
    id: string;
    title: string;
    content: string | null;
    original_url: string | null;
    channel_id: string | null;
    channels?: {
      name: string;
      source: string;
    } | null;
  } | null;
  prompt?: {
    id: string;
    name: string;
  } | null;
}

interface UseRewrittenContentFilters {
  search?: string;
  source?: string;
  promptId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useRewrittenContent() {
  const [content, setContent] = useState<RewrittenContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchContent = useCallback(async (filters?: UseRewrittenContentFilters) => {
    setLoading(true);
    try {
      let query = supabase
        .from('rewritten_content')
        .select(`
          *,
          parsed_content:parsed_content_id (
            id,
            title,
            content,
            original_url,
            channel_id,
            channels:channel_id (
              name,
              source
            )
          ),
          prompt:prompt_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date filters
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters?.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      // Apply prompt filter
      if (filters?.promptId && filters.promptId !== 'all') {
        query = query.eq('prompt_id', filters.promptId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Client-side filtering for search and source (since we need to filter on joined data)
      let filtered = (data || []) as RewrittenContentItem[];

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(item =>
          item.rewritten_text?.toLowerCase().includes(searchLower) ||
          item.hook?.toLowerCase().includes(searchLower) ||
          item.parsed_content?.title?.toLowerCase().includes(searchLower)
        );
      }

      if (filters?.source && filters.source !== 'all') {
        filtered = filtered.filter(item =>
          item.parsed_content?.channels?.source === filters.source
        );
      }

      setContent(filtered);
    } catch (error) {
      console.error('Error fetching rewritten content:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить результаты рерайта',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteRewrite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rewritten_content')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContent(prev => prev.filter(item => item.id !== id));
      toast({
        title: 'Удалено',
        description: 'Результат рерайта удален',
      });
    } catch (error) {
      console.error('Error deleting rewrite:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить',
        variant: 'destructive',
      });
    }
  };

  const updateRewrite = async (id: string, updates: Partial<RewrittenContentItem>) => {
    try {
      const { error } = await supabase
        .from('rewritten_content')
        .update({
          rewritten_text: updates.rewritten_text,
          script: updates.script,
          hook: updates.hook,
          cta: updates.cta,
        })
        .eq('id', id);

      if (error) throw error;

      setContent(prev => prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ));
      toast({
        title: 'Сохранено',
        description: 'Изменения сохранены',
      });
    } catch (error) {
      console.error('Error updating rewrite:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return {
    content,
    loading,
    fetchContent,
    deleteRewrite,
    updateRewrite,
    refetch: () => fetchContent(),
  };
}
