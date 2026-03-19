import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AutomationSetting {
  id: string;
  button_key: string;
  process_key: string;
  process_label: string;
  is_enabled: boolean;
}

export function useAutomationSettings() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['automation_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .order('button_key')
        .order('process_key');
      if (error) throw error;
      return data as AutomationSetting[];
    },
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ buttonKey, processKey, enabled }: { buttonKey: string; processKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('automation_settings')
        .update({ is_enabled: enabled })
        .eq('button_key', buttonKey)
        .eq('process_key', processKey);
      if (error) throw error;
    },
    onMutate: async ({ buttonKey, processKey, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['automation_settings'] });
      const prev = queryClient.getQueryData<AutomationSetting[]>(['automation_settings']);
      queryClient.setQueryData<AutomationSetting[]>(['automation_settings'], old =>
        (old || []).map(s =>
          s.button_key === buttonKey && s.process_key === processKey
            ? { ...s, is_enabled: enabled }
            : s
        )
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['automation_settings'], context.prev);
    },
  });

  const isEnabled = (buttonKey: string, processKey: string): boolean => {
    if (isLoading) return false;
    const setting = settings.find(s => s.button_key === buttonKey && s.process_key === processKey);
    return setting?.is_enabled ?? false;
  };

  const toggle = (buttonKey: string, processKey: string, enabled: boolean) => {
    toggleMutation.mutate({ buttonKey, processKey, enabled });
  };

  return { settings, isLoading, isEnabled, toggle };
}
