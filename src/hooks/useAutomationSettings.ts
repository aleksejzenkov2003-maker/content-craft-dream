import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ActionMode = 'single' | 'bulk';

export interface ScenarioStep {
  buttonKey: string;
  buttonLabel: string;
  processes: { key: string; label: string }[];
}

const SINGLE_SCENARIO: Record<string, string[]> = {
  side_step1: ['atmosphere'],
  side_cover: ['cover_overlay', 'hook_overlay'],
  voiceover: ['voiceover', 'subtitles'],
  side_video: ['motion', 'heygen'],
  resize: ['resize'],
  burn_subtitles: ['subtitles'],
  prepare_publish: ['create_publication', 'concat', 'generate_text'],
  publish: ['publish_social'],
};

const BULK_SCENARIO: Record<string, string[]> = {
  take_in_work: ['voiceover', 'subtitles', 'atmosphere', 'cover_overlay', 'hook_overlay', 'motion'],
  side_video: ['heygen', 'resize', 'subtitles'],
  prepare_publish: ['create_publication', 'concat', 'generate_text'],
  publish: ['publish_social'],
};

const PROCESS_LABELS: Record<string, string> = {
  atmosphere: 'Генерация фона',
  cover_overlay: 'Склейка фона с миниатюрой',
  hook_overlay: 'Добавление заголовка',
  voiceover: 'Генерация аудио',
  subtitles: 'Генерация/наложение субтитров',
  motion: 'Подготовка motion-аватара',
  heygen: 'Генерация видео в HeyGen',
  resize: 'Сжатие видео',
  create_publication: 'Добавление задачи на публикацию',
  concat: 'Склейка обложек с видео',
  generate_text: 'Генерация описания к ролику',
  publish_social: 'Публикация',
};

const BUTTON_LABELS: Record<string, string> = {
  side_step1: 'Шаг 1. Фон',
  side_cover: 'Шаг 2. Обложка',
  voiceover: 'Озвучка',
  side_video: 'Шаг 3. Видео',
  resize: 'Уменьшить размер видео',
  burn_subtitles: 'Вшить субтитры',
  prepare_publish: 'Подготовка к публикации',
  publish: 'Публикация в соцсетях',
  take_in_work: 'Взять в работу',
};

function scenarioToSteps(scenario: Record<string, string[]>): ScenarioStep[] {
  return Object.entries(scenario).map(([buttonKey, processKeys]) => ({
    buttonKey,
    buttonLabel: BUTTON_LABELS[buttonKey] ?? buttonKey,
    processes: processKeys.map(k => ({ key: k, label: PROCESS_LABELS[k] ?? k })),
  }));
}

export const SINGLE_STEPS = scenarioToSteps(SINGLE_SCENARIO);
export const BULK_STEPS = scenarioToSteps(BULK_SCENARIO);

export function useAutomationSettings() {
  const queryClient = useQueryClient();

  const { data: mode = 'single' as ActionMode, isLoading } = useQuery({
    queryKey: ['action_mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'action_mode')
        .single();
      if (error || !data) return 'single' as ActionMode;
      return (data.value === 'bulk' ? 'bulk' : 'single') as ActionMode;
    },
    staleTime: 60_000,
  });

  const setModeMutation = useMutation({
    mutationFn: async (newMode: ActionMode) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'action_mode', value: newMode, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onMutate: async (newMode) => {
      await queryClient.cancelQueries({ queryKey: ['action_mode'] });
      const prev = queryClient.getQueryData<ActionMode>(['action_mode']);
      queryClient.setQueryData(['action_mode'], newMode);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['action_mode'], context.prev);
    },
  });

  const isEnabled = (buttonKey: string, processKey: string): boolean => {
    const scenario = mode === 'bulk' ? BULK_SCENARIO : SINGLE_SCENARIO;
    return scenario[buttonKey]?.includes(processKey) ?? false;
  };

  const setMode = (newMode: ActionMode) => {
    setModeMutation.mutate(newMode);
  };

  return { mode, isLoading, isEnabled, setMode, settings: [], toggle: () => {} };
}
