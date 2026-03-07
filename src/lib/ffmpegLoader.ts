import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;
const blobUrls: string[] = [];

const FF_CORE_CANDIDATES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
];

function revokeBlobUrls() {
  for (const url of blobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
  }
  blobUrls.length = 0;
}

async function fetchWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader || !contentLength) {
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.push(blobUrl);
    return blobUrl;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    signal?.throwIfAborted();
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, contentLength);
  }

  const blob = new Blob(chunks as unknown as BlobPart[], {
    type: url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
  });
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.push(blobUrl);
  return blobUrl;
}

async function loadFFmpegCore(
  instance: FFmpeg,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let lastError: unknown = null;

  for (const baseURL of FF_CORE_CANDIDATES) {
    try {
      signal?.throwIfAborted();
      onProgress?.(2);
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      blobUrls.push(coreURL);
      onProgress?.(4);

      signal?.throwIfAborted();
      const wasmURL = await fetchWithProgress(
        `${baseURL}/ffmpeg-core.wasm`,
        (loaded, total) => {
          const pct = 4 + Math.round((loaded / total) * 10); // 4-14%
          onProgress?.(pct);
        },
        signal
      );

      onProgress?.(14);

      // Heartbeat during WASM compilation (14→20)
      let heartbeat = 14;
      const heartbeatTimer = setInterval(() => {
        if (heartbeat < 20) {
          heartbeat += 1;
          onProgress?.(heartbeat);
        }
      }, 800);

      try {
        signal?.throwIfAborted();
        await instance.load({ coreURL, wasmURL });
      } finally {
        clearInterval(heartbeatTimer);
      }

      onProgress?.(20);
      return;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      console.warn('[ffmpegLoader] Failed CDN:', baseURL, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не удалось загрузить FFmpeg core');
}

function cleanup() {
  loadingPromise = null;
  ffmpeg = null;
  revokeBlobUrls();
}

/**
 * Returns a shared FFmpeg instance, loading it from CDN if needed.
 * Progress callback receives 0-20 during loading phase.
 */
export async function getSharedFFmpeg(
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    onProgress?.(20);
    return ffmpeg;
  }

  if (loadingPromise) {
    await loadingPromise;
    if (ffmpeg && ffmpeg.loaded) {
      onProgress?.(20);
      return ffmpeg;
    }
    // Previous load failed, fall through
  }

  ffmpeg = new FFmpeg();
  onProgress?.(1);

  loadingPromise = loadFFmpegCore(ffmpeg, onProgress, signal);

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
    cleanup();
    throw err;
  }
}

/**
 * Preload FFmpeg in background silently.
 */
export function preloadFFmpeg(): void {
  getSharedFFmpeg().catch(() => { /* silent */ });
}
