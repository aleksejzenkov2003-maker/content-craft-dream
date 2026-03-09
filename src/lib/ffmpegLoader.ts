import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

const CORE_CDN_BASES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
];

// The @ffmpeg/ffmpeg library's own worker file (NOT the core worker)
const CLASS_WORKER_URLS = [
  'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js',
];

const ATTEMPT_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

function cleanup() {
  loadingPromise = null;
  ffmpeg = null;
}

/**
 * Check if the browser environment supports FFmpeg WASM.
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
  coreBaseURL: string,
  classWorkerUrl: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  onProgress?.(2);

  const coreURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript');
  onProgress?.(6);
  signal?.throwIfAborted();

  const wasmURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm');
  onProgress?.(12);
  signal?.throwIfAborted();

  // IMPORTANT: class worker must stay as real URL (not blob),
  // because it imports ./const.js and ./errors.js relatively.
  const classWorkerURL = classWorkerUrl;
  onProgress?.(14);
  signal?.throwIfAborted();

  console.log('[ffmpegLoader] Loading with ESM core + classWorkerURL…');

  // Wrap instance.load with a hard timeout
  const loadPromise = instance.load({ coreURL, wasmURL, classWorkerURL });
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = globalThis.setTimeout(
      () => reject(new Error('FFmpeg load() зависла — таймаут 30с')),
      ATTEMPT_TIMEOUT_MS,
    );
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
    // Try each combination of core CDN + class worker CDN
    for (let i = 0; i < CORE_CDN_BASES.length; i++) {
      const coreBase = CORE_CDN_BASES[i];
      const workerUrl = CLASS_WORKER_URLS[i] || CLASS_WORKER_URLS[0];

      try {
        signal?.throwIfAborted();
        await tryLoadFromCDN(ffmpeg!, coreBase, workerUrl, onProgress, signal);
        console.log('[ffmpegLoader] Loaded successfully from:', coreBase);
        return; // success
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err;
        console.warn('[ffmpegLoader] Failed CDN:', coreBase, err);
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
