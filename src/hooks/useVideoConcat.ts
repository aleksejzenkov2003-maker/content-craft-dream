import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { concatVideosClient, ConcatPhase } from '@/lib/videoConcat';
import { terminateSharedFFmpeg } from '@/lib/ffmpegLoader';

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
  const publicationIdRef = useRef<string | null>(null);

  const restorePublicationAfterCancel = useCallback(async (publicationId: string) => {
    const { data } = await supabase
      .from('publications')
      .select('final_video_url')
      .eq('id', publicationId)
      .maybeSingle();

    const nextStatus = data?.final_video_url ? 'checked' : 'needs_concat';

    await supabase
      .from('publications')
      .update({
        publication_status: nextStatus,
        error_message: 'Склейка остановлена пользователем',
      })
      .eq('id', publicationId);
  }, []);

  const cancelConcat = useCallback(async (publicationId?: string) => {
    const targetPublicationId = publicationId ?? publicationIdRef.current;

    abortRef.current?.abort();
    terminateSharedFFmpeg();
    abortRef.current = null;
    publicationIdRef.current = null;
    setState({ loading: false, progress: 0, phase: null, error: null });

    if (targetPublicationId) {
      await restorePublicationAfterCancel(targetPublicationId);
    }

    toast.info('Склейка остановлена');
  }, [restorePublicationAfterCancel]);

  const concatVideos = useCallback(async (
    publicationId: string,
    mainVideoUrl: string,
    backCoverVideoUrl: string,
    frontCoverImageUrl?: string | null,
  ) => {
    const previousPublicationId = publicationIdRef.current;

    if (abortRef.current) {
      abortRef.current.abort();
      terminateSharedFFmpeg();
      if (previousPublicationId && previousPublicationId !== publicationId) {
        void restorePublicationAfterCancel(previousPublicationId);
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    publicationIdRef.current = publicationId;

    setState({ loading: true, progress: 0, phase: 'loading_ffmpeg', error: null });

    try {
      await supabase
        .from('publications')
        .update({ publication_status: 'concatenating', error_message: null })
        .eq('id', publicationId);

      const file = await concatVideosClient(
        mainVideoUrl,
        backCoverVideoUrl,
        (info) => {
          setState(prev => ({ ...prev, progress: info.progress, phase: info.phase }));
        },
        controller.signal,
        frontCoverImageUrl,
      );

      controller.signal.throwIfAborted();

      setState(prev => ({ ...prev, phase: 'done', progress: 96 }));
      const fileName = `concat/${publicationId}_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, file, { contentType: 'video/mp4', upsert: true });

      if (uploadError) throw new Error(`Ошибка загрузки: ${uploadError.message}`);

      controller.signal.throwIfAborted();

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      const finalUrl = urlData.publicUrl;

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
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (publicationIdRef.current === publicationId) {
        publicationIdRef.current = null;
      }
    }
  }, [restorePublicationAfterCancel]);

  return {
    concatVideos,
    cancelConcat,
    ...state,
  };
}

