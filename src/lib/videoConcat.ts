import { getSharedFFmpeg } from './ffmpegLoader';

export type ConcatPhase =
  | 'loading_ffmpeg'
  | 'downloading'
  | 'concatenating'
  | 'done';

export interface ConcatProgressInfo {
  phase: ConcatPhase;
  progress: number;
}

const PHASE_LABELS: Record<ConcatPhase, string> = {
  loading_ffmpeg: 'Загрузка FFmpeg',
  downloading: 'Скачивание видео',
  concatenating: 'Склейка видео',
  done: 'Готово',
};

export function getConcatPhaseLabel(phase: ConcatPhase): string {
  return PHASE_LABELS[phase];
}

/**
 * Concatenates two MP4 videos using ffmpeg.wasm concat filter.
 * Re-encodes both streams → guarantees codec compatibility.
 */
export async function concatVideosClient(
  mainVideoUrl: string,
  backCoverVideoUrl: string,
  onProgress?: (info: ConcatProgressInfo) => void,
  signal?: AbortSignal,
): Promise<File> {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mainName = `main_${uid}.mp4`;
  const backName = `back_${uid}.mp4`;
  const outputName = `concat_${uid}.mp4`;

  signal?.throwIfAborted();

  // 1. Load ffmpeg (0-20%)
  onProgress?.({ phase: 'loading_ffmpeg', progress: 2 });
  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(20, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  // 2. Download both videos (20-50%)
  onProgress?.({ phase: 'downloading', progress: 22 });

  const [mainBuf, backBuf] = await Promise.all([
    fetchVideo(mainVideoUrl, signal),
    fetchVideo(backCoverVideoUrl, signal),
  ]);

  onProgress?.({ phase: 'downloading', progress: 48 });
  signal?.throwIfAborted();

  // 3. Write to virtual FS
  await ff.writeFile(mainName, new Uint8Array(mainBuf));
  await ff.writeFile(backName, new Uint8Array(backBuf));
  onProgress?.({ phase: 'downloading', progress: 50 });

  // 4. Run concat filter (50-95%)
  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 50 + Math.round(progress * 45); // 50-95
    onProgress?.({ phase: 'concatenating', progress: Math.max(50, Math.min(95, mapped)) });
  };

  ff.on('progress', progressHandler);

  try {
    signal?.throwIfAborted();
    onProgress?.({ phase: 'concatenating', progress: 52 });

    await ff.exec([
      '-i', mainName,
      '-i', backName,
      '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]',
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-ar', '48000',
      '-b:a', '128k',
      '-y', outputName,
    ]);

    signal?.throwIfAborted();

    // 5. Read result
    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    onProgress?.({ phase: 'done', progress: 100 });
    return new File([blob], 'concatenated.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(mainName).catch(() => undefined);
    await ff.deleteFile(backName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

async function fetchVideo(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Не удалось скачать видео: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
