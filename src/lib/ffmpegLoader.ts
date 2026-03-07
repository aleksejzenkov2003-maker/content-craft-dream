import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

const FF_CORE_CANDIDATES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
];

async function fetchWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader || !contentLength) {
    // Fallback: no streaming progress
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, contentLength);
  }

  const blob = new Blob(chunks, {
    type: url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
  });
  return URL.createObjectURL(blob);
}

async function loadFFmpegCore(
  instance: FFmpeg,
  onProgress?: (pct: number) => void
): Promise<void> {
  let lastError: unknown = null;

  for (const baseURL of FF_CORE_CANDIDATES) {
    try {
      onProgress?.(2);
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      onProgress?.(4);

      const wasmURL = await fetchWithProgress(
        `${baseURL}/ffmpeg-core.wasm`,
        (loaded, total) => {
          const pct = 4 + Math.round((loaded / total) * 10); // 4-14%
          onProgress?.(pct);
        }
      );

      onProgress?.(14);
      await instance.load({ coreURL, wasmURL });
      onProgress?.(15);
      return;
    } catch (error) {
      lastError = error;
      console.warn('[ffmpegLoader] Failed CDN:', baseURL, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не удалось загрузить FFmpeg core');
}

/**
 * Returns a shared FFmpeg instance, loading it from CDN if needed.
 * Progress callback receives 0-15 during loading phase.
 */
export async function getSharedFFmpeg(
  onProgress?: (pct: number) => void
): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    onProgress?.(15);
    return ffmpeg;
  }

  if (loadingPromise) {
    await loadingPromise;
    return ffmpeg!;
  }

  ffmpeg = new FFmpeg();
  onProgress?.(1);

  loadingPromise = loadFFmpegCore(ffmpeg, onProgress);

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('FFmpeg долго загружается (180 с). Проверьте интернет и попробуйте снова.')),
      180_000
    );
  });

  try {
    await Promise.race([loadingPromise, timeout]);
    return ffmpeg!;
  } catch (err) {
    loadingPromise = null;
    ffmpeg = null;
    throw err;
  }
}
