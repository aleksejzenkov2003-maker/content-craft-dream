import { callVpsFFmpeg } from './vpsClient';

export type ConcatPhase =
  | 'loading_ffmpeg'
  | 'downloading'
  | 'normalizing'
  | 'creating_intro'
  | 'concatenating'
  | 'done';

export interface ConcatProgressInfo {
  phase: ConcatPhase;
  progress: number;
}

const PHASE_LABELS: Record<ConcatPhase, string> = {
  loading_ffmpeg: 'Подготовка',
  downloading: 'Скачивание видео',
  normalizing: 'Нормализация сегментов',
  creating_intro: 'Создание интро из обложки',
  concatenating: 'Склейка видео на сервере',
  done: 'Готово',
};

export function getConcatPhaseLabel(phase: ConcatPhase): string {
  return PHASE_LABELS[phase];
}

/**
 * Concatenates videos via VPS FFmpeg server.
 * Returns public URL of the concatenated video.
 */
export async function concatVideosClient(
  mainVideoUrl: string,
  backCoverVideoUrl: string,
  onProgress?: (info: ConcatProgressInfo) => void,
  signal?: AbortSignal,
  frontCoverImageUrl?: string | null,
): Promise<string> {
  signal?.throwIfAborted();

  onProgress?.({ phase: 'concatenating', progress: 10 });

  const result = await callVpsFFmpeg('concat', {
    main_video_url: mainVideoUrl,
    back_cover_video_url: backCoverVideoUrl,
    front_cover_image_url: frontCoverImageUrl || undefined,
  });

  signal?.throwIfAborted();
  onProgress?.({ phase: 'done', progress: 100 });

  if (!result.url) throw new Error('VPS concat did not return a URL');
  return result.url;
}
