import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
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
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress }) => {
      setState(prev => ({ ...prev, progress: Math.round(progress * 100) }));
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loadedRef.current = true;
    return ffmpeg;
  }, []);

  const concatVideos = useCallback(async (
    publicationId: string,
    mainVideoUrl: string,
    backCoverVideoUrl: string,
  ) => {
    setState({ loading: true, progress: 0, error: null });

    try {
      // Update status to concatenating
      await supabase
        .from('publications')
        .update({ publication_status: 'concatenating' })
        .eq('id', publicationId);

      setState(prev => ({ ...prev, progress: 5 }));

      // Load ffmpeg
      const ffmpeg = await loadFFmpeg();
      setState(prev => ({ ...prev, progress: 15 }));

      // Download videos
      const mainData = await fetchFile(mainVideoUrl);
      setState(prev => ({ ...prev, progress: 35 }));

      const backCoverData = await fetchFile(backCoverVideoUrl);
      setState(prev => ({ ...prev, progress: 55 }));

      // Write files to ffmpeg FS
      await ffmpeg.writeFile('main.mp4', mainData);
      await ffmpeg.writeFile('backcover.mp4', backCoverData);

      // Create concat file
      const concatList = "file 'main.mp4'\nfile 'backcover.mp4'\n";
      await ffmpeg.writeFile('concat.txt', concatList);

      // Run ffmpeg concat (fast path: stream copy, fallback: re-encode for incompatible codecs)
      try {
        await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c', 'copy',
          'output.mp4',
        ]);
      } catch {
        await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          'output.mp4',
        ]);
      }

      setState(prev => ({ ...prev, progress: 80 }));

      // Read output
      const outputData = await ffmpeg.readFile('output.mp4');
      const uint8 = outputData instanceof Uint8Array ? outputData : new TextEncoder().encode(outputData as string);
      const outputBlob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

      // Upload to storage
      const fileName = `concat/${publicationId}_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, outputBlob, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      const finalUrl = urlData.publicUrl;

      // Update publication
      await supabase
        .from('publications')
        .update({
          final_video_url: finalUrl,
          publication_status: 'checked',
        })
        .eq('id', publicationId);

      setState({ loading: false, progress: 100, error: null });

      // Cleanup ffmpeg FS
      try {
        await ffmpeg.deleteFile('main.mp4');
        await ffmpeg.deleteFile('backcover.mp4');
        await ffmpeg.deleteFile('concat.txt');
        await ffmpeg.deleteFile('output.mp4');
      } catch {}

      toast.success('Видео склеено успешно');
      return finalUrl;
    } catch (error: any) {
      console.error('Video concat error:', error);
      const errorMsg = error.message || 'Ошибка склейки видео';

      await supabase
        .from('publications')
        .update({
          publication_status: 'error',
          error_message: errorMsg,
        })
        .eq('id', publicationId);

      setState({ loading: false, progress: 0, error: errorMsg });
      toast.error(`Ошибка склейки: ${errorMsg}`);
      throw error;
    }
  }, [loadFFmpeg]);

  return {
    concatVideos,
    ...state,
  };
}
