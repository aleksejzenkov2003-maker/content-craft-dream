import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

const CDN_BASES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
];

const ATTEMPT_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

function cleanup() {
  loadingPromise = null;
  ffmpeg = null;
}

/**
 * Check if the browser environment supports FFmpeg WASM.
 * Cross-origin iframes may lack SharedArrayBuffer.
 */
export function isBrowserFFmpegSupported(): boolean {
  try {
    return typeof globalThis.Worker !== 'undefined';
  } catch {
    return false;
  }
}

async function tryLoadFromCDN(
  instance: FFmpeg,
  baseURL: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  onProgress?.(2);

  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
  onProgress?.(8);
  signal?.throwIfAborted();

  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
  onProgress?.(16);
  signal?.throwIfAborted();

  // UMD build — no workerURL needed
  // Wrap instance.load with a hard timeout to avoid silent hangs
  const loadPromise = instance.load({ coreURL, wasmURL });
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = globalThis.setTimeout(
      () => reject(new Error('FFmpeg load() зависла — таймаут 30с')),
      ATTEMPT_TIMEOUT_MS,
    );
    // If signal fires, also reject
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason || new Error('Aborted'));
    }, { once: true });
  });

  await Promise.race([loadPromise, timeoutPromise]);
  onProgress?.(20);
}

/**
 * Returns a shared FFmpeg instance, loading it from CDN if needed.
 * Progress callback receives 0-20 during loading phase.
 */
export async function getSharedFFmpeg(
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
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
  }

  if (!isBrowserFFmpegSupported()) {
    throw new Error('Браузер не поддерживает FFmpeg WASM (нет Worker API)');
  }

  ffmpeg = new FFmpeg();
  onProgress?.(1);

  let lastError: unknown = null;

  const doLoad = async () => {
    for (const baseURL of CDN_BASES) {
      try {
        signal?.throwIfAborted();
        await tryLoadFromCDN(ffmpeg!, baseURL, onProgress, signal);
        return; // success
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err;
        console.warn('[ffmpegLoader] Failed CDN:', baseURL, err);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Не удалось загрузить FFmpeg');
  };

  loadingPromise = doLoad();

  const timeout = new Promise<never>((_, reject) => {
    globalThis.setTimeout(
      () => reject(new Error('FFmpeg загрузка превысила 120 секунд')),
      TOTAL_TIMEOUT_MS,
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
  if (!isBrowserFFmpegSupported()) return;
  getSharedFFmpeg().catch(() => { /* silent */ });
}
