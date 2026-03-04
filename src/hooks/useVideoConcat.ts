import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConcatState {
  loading: boolean;
  progress: number;
  error: string | null;
}

export function useVideoConcat() {
  const [state, setState] = useState<ConcatState>({
    loading: false,
    progress: 0,
    error: null,
  });

  const concatVideos = useCallback(async (
    publicationId: string,
    mainVideoUrl: string,
    backCoverVideoUrl: string,
  ) => {
    setState({ loading: true, progress: 10, error: null });

    try {
      // Call the server-side Edge Function
      setState(prev => ({ ...prev, progress: 20 }));

      const { data, error } = await supabase.functions.invoke('concat-video', {
        body: {
          publication_id: publicationId,
          main_video_url: mainVideoUrl,
          back_cover_video_url: backCoverVideoUrl,
        },
      });

      if (error) throw new Error(error.message || 'Edge Function error');
      if (data?.error) throw new Error(data.error);

      setState(prev => ({ ...prev, progress: 50 }));

      // Poll for completion
      const finalUrl = await pollForCompletion(publicationId);

      setState({ loading: false, progress: 100, error: null });
      toast.success('Видео склеено успешно');
      return finalUrl;
    } catch (error: any) {
      console.error('Video concat error:', error);
      const errorMsg = error.message || 'Ошибка склейки видео';

      await supabase
        .from('publications')
        .update({
          publication_status: 'needs_concat',
          error_message: errorMsg,
        })
        .eq('id', publicationId);

      setState({ loading: false, progress: 0, error: errorMsg });
      toast.error(`Ошибка склейки: ${errorMsg}`);
      throw error;
    }
  }, []);

  return {
    concatVideos,
    ...state,
  };
}

async function pollForCompletion(publicationId: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const { data } = await supabase
      .from('publications')
      .select('publication_status, final_video_url, error_message')
      .eq('id', publicationId)
      .single();

    if (!data) continue;

    if (data.publication_status === 'checked' && data.final_video_url) {
      return data.final_video_url;
    }

    if (data.publication_status === 'needs_concat' || data.error_message) {
      throw new Error(data.error_message || 'Concatenation failed');
    }
  }

  throw new Error('Таймаут ожидания склейки');
}
