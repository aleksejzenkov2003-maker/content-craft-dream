import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DbPrompt {
  id: string;
  name: string;
  type: string;
  system_prompt: string;
  user_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
}

export function usePrompts() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error: unknown) {
      console.error('Error fetching prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const updatePrompt = async (id: string, updates: Partial<DbPrompt>) => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setPrompts(prev => prev.map(p => p.id === id ? data : p));
      toast({
        title: 'Промпт сохранен'
      });
      
      return data;
    } catch (error: unknown) {
      console.error('Error updating prompt:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить промпт',
        variant: 'destructive'
      });
    }
  };

  const testPrompt = async (prompt: DbPrompt, testContent: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-prompt', {
        body: {
          systemPrompt: prompt.system_prompt,
          userTemplate: prompt.user_template,
          testContent,
          type: prompt.type,
          model: prompt.model,
          temperature: prompt.temperature,
          maxTokens: prompt.max_tokens
        }
      });

      if (error) throw error;

      if (data?.success) {
        return data.result;
      } else {
        throw new Error(data?.error || 'Test failed');
      }
    } catch (error: unknown) {
      console.error('Test prompt error:', error);
      toast({
        title: 'Ошибка теста',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const addPrompt = async (prompt: Omit<DbPrompt, 'id' | 'created_at' | 'is_active'>) => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .insert({ ...prompt, is_active: false })
        .select()
        .single();

      if (error) throw error;
      
      setPrompts(prev => [data, ...prev]);
      toast({
        title: 'Промпт создан'
      });
      
      return data;
    } catch (error: unknown) {
      console.error('Error adding prompt:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать промпт',
        variant: 'destructive'
      });
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPrompts(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Промпт удалён'
      });
    } catch (error: unknown) {
      console.error('Error deleting prompt:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить промпт',
        variant: 'destructive'
      });
    }
  };

  return {
    prompts,
    loading,
    updatePrompt,
    testPrompt,
    addPrompt,
    deletePrompt,
    refetch: fetchPrompts
  };
}
