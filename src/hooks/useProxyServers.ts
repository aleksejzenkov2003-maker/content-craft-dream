import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProxyServer {
  id: string;
  name: string;
  login: string | null;
  password: string | null;
  server: string;
  port: number;
  protocol: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProxyServers() {
  const [proxies, setProxies] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProxies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proxy_servers')
        .select('*')
        .order('name');

      if (error) throw error;
      setProxies((data || []) as ProxyServer[]);
    } catch (error: any) {
      console.error('Error fetching proxy servers:', error);
      toast.error('Ошибка загрузки прокси-серверов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  const addProxy = async (data: Partial<ProxyServer>) => {
    try {
      const { error } = await supabase
        .from('proxy_servers')
        .insert({
          name: data.name!,
          login: data.login || null,
          password: data.password || null,
          server: data.server!,
          port: data.port || 8080,
          protocol: data.protocol || 'HTTP',
          is_active: data.is_active ?? true,
        });

      if (error) throw error;
      await fetchProxies();
      toast.success('Прокси добавлен');
    } catch (error: any) {
      console.error('Error adding proxy:', error);
      toast.error('Ошибка добавления прокси');
      throw error;
    }
  };

  const updateProxy = async (id: string, updates: Partial<ProxyServer>) => {
    try {
      const { error } = await supabase
        .from('proxy_servers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchProxies();
      toast.success('Прокси обновлён');
    } catch (error: any) {
      console.error('Error updating proxy:', error);
      toast.error('Ошибка обновления прокси');
      throw error;
    }
  };

  const deleteProxy = async (id: string) => {
    try {
      const { error } = await supabase
        .from('proxy_servers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchProxies();
      toast.success('Прокси удалён');
    } catch (error: any) {
      console.error('Error deleting proxy:', error);
      toast.error('Ошибка удаления прокси');
      throw error;
    }
  };

  return {
    proxies,
    loading,
    refetch: fetchProxies,
    addProxy,
    updateProxy,
    deleteProxy,
  };
}
