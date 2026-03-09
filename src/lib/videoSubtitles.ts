import { generateAss, generateSrt, type WordTimestamp } from './srtGenerator';
import { getSharedFFmpeg, isBrowserFFmpegSupported } from './ffmpegLoader';
import { supabase } from '@/integrations/supabase/client';

export type SubtitlePhase =
  | 'server_processing'
  | 'loading_ffmpeg'
  | 'downloading_video'
  | 'burning_subtitles'
  | 'uploading_result';

export interface SubtitleOptions {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  outlineColor?: string;
  outline?: number;
  marginV?: number;
}

export interface SubtitleProgressInfo {
  phase: SubtitlePhase;
  progress: number;
}

const PHASE_LABELS: Record<SubtitlePhase, string> = {
  server_processing: 'Обработка на сервере',
  loading_ffmpeg: 'Загрузка FFmpeg',
  downloading_video: 'Скачивание видео',
  burning_subtitles: 'Вшивка субтитров',
  uploading_result: 'Загрузка результата',
};

export function getPhaseLabel(phase: SubtitlePhase): string {
  return PHASE_LABELS[phase];
}

/**
 * Tier 1: Server-side subtitle burning via edge function (self-contained FFmpeg WASM in Deno).
 * Returns { status, videoUrl } on success, or throws on error.
 */
export async function burnSubtitlesServer(
  videoId: string,
  onProgress?: (info: SubtitleProgressInfo) => void,
): Promise<{ status: string; videoUrl?: string }> {
  onProgress?.({ phase: 'server_processing', progress: 10 });

  const { data, error } = await supabase.functions.invoke('burn-subtitles', {
    body: { videoId },
  });

  if (error) {
    console.warn('[subtitles] Server-side failed:', error);
    throw new Error(error.message || 'Server processing failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  onProgress?.({ phase: 'server_processing', progress: 100 });

  return {
    status: data?.status || 'completed',
    videoUrl: data?.videoUrl,
  };
}

/**
 * Tier 2: Browser-side subtitle burning via ffmpeg.wasm (fallback).
 */
export async function burnSubtitlesBrowser(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
): Promise<File> {
  if (!isBrowserFFmpegSupported()) {
    throw new Error('Браузер не поддерживает FFmpeg WASM');
  }

  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const inputName = `in_${uid}.mp4`;
  const subsName = `subs_${uid}.ass`;
  const outputName = `out_${uid}.mp4`;

  signal?.throwIfAborted();
  onProgress?.({ phase: 'loading_ffmpeg', progress: 5 });

  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(20, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 40 + Math.round(progress * 50);
    onProgress?.({ phase: 'burning_subtitles', progress: Math.max(40, Math.min(90, mapped)) });
  };

  ff.on('progress', progressHandler);

  try {
    onProgress?.({ phase: 'downloading_video', progress: 22 });

    const assContent = generateAss(wordTimestamps, {
      useSmartBlocks: true,
      fontName: options.fontName ?? 'Montserrat',
      fontSize: options.fontSize ?? 48,
      primaryColor: options.primaryColor ?? '&H00FFFFFF',
      outlineColor: options.outlineColor ?? '&H00000000',
      outline: options.outline ?? 1,
      marginV: options.marginV ?? 80,
    });

    signal?.throwIfAborted();

    const videoResponse = await fetch(videoUrl, { signal });
    if (!videoResponse.ok) {
      throw new Error(`Не удалось скачать видео: HTTP ${videoResponse.status}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.({ phase: 'downloading_video', progress: 35 });

    signal?.throwIfAborted();

    await ff.writeFile(inputName, new Uint8Array(videoBuffer));
    await ff.writeFile(subsName, new TextEncoder().encode(assContent));

    onProgress?.({ phase: 'burning_subtitles', progress: 40 });

    await ff.exec([
      '-i', inputName,
      '-vf', `ass=${subsName}`,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ]);

    signal?.throwIfAborted();
    onProgress?.({ phase: 'uploading_result', progress: 92 });

    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    onProgress?.({ phase: 'uploading_result', progress: 100 });
    return new File([blob], 'video_with_subtitles.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(subsName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

/**
 * Tier 3: Download SRT/ASS file as fallback.
 */
export function downloadSubtitleFile(
  wordTimestamps: WordTimestamp[],
  format: 'srt' | 'ass' = 'srt',
): void {
  const content = format === 'ass'
    ? generateAss(wordTimestamps, { useSmartBlocks: true })
    : generateSrt(wordTimestamps);
  const ext = format;
  const mime = format === 'ass' ? 'text/x-ssa' : 'text/srt';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subtitles.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Legacy export for backward compatibility
export const burnSubtitles = burnSubtitlesBrowser;
