import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { concatVideosClient, ConcatPhase, getConcatPhaseLabel } from '@/lib/videoConcat';

interface ConcatState {
  loading: boolean;
  progress: number;
  phase: ConcatPhase | null;
  error: string | null;
}

export function useVideoConcat() {
  const [state, setState] = useState<ConcatState>({
    loading: false,
    progress: 0,
    phase: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const concatVideos = useCallback(async (
    publicationId: string,
    mainVideoUrl: string,
    backCoverVideoUrl: string,
  ) => {
    // Abort any previous concat
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ loading: true, progress: 0, phase: 'loading_ffmpeg', error: null });

    try {
      // Update status to concatenating
      await supabase
        .from('publications')
        .update({ publication_status: 'concatenating', error_message: null })
        .eq('id', publicationId);

      // Run client-side concat
      const file = await concatVideosClient(
        mainVideoUrl,
        backCoverVideoUrl,
        (info) => {
          setState(prev => ({ ...prev, progress: info.progress, phase: info.phase }));
        },
        controller.signal,
      );

      // Upload to storage
      setState(prev => ({ ...prev, phase: 'done', progress: 96 }));
      const fileName = `concat/${publicationId}_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, file, { contentType: 'video/mp4', upsert: true });

      if (uploadError) throw new Error(`Ошибка загрузки: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      const finalUrl = urlData.publicUrl;

      // Update publication
      await supabase
        .from('publications')
        .update({
          publication_status: 'checked',
          final_video_url: finalUrl,
          error_message: null,
        })
        .eq('id', publicationId);

      setState({ loading: false, progress: 100, phase: 'done', error: null });
      toast.success('Видео склеено успешно');
      return finalUrl;
    } catch (error: any) {
      if (controller.signal.aborted) {
        setState({ loading: false, progress: 0, phase: null, error: null });
        return;
      }

      console.error('Video concat error:', error);
      const errorMsg = error.message || 'Ошибка склейки видео';

      await supabase
        .from('publications')
        .update({
          publication_status: 'needs_concat',
          error_message: errorMsg,
        })
        .eq('id', publicationId);

      setState({ loading: false, progress: 0, phase: null, error: errorMsg });
      toast.error(`Ошибка склейки: ${errorMsg}`);
      throw error;
    }
  }, []);

  const cancelConcat = useCallback(() => {
    abortRef.current?.abort();
    setState({ loading: false, progress: 0, phase: null, error: null });
  }, []);

  return {
    concatVideos,
    cancelConcat,
    ...state,
  };
}
