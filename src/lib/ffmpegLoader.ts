import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

const FF_CORE_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
];

const CDN_ATTEMPT_TIMEOUT_MS = 60_000;
const LOAD_TIMEOUT_MS = 180_000;

function createLinkedAbortController(signal?: AbortSignal) {
  const controller = new AbortController();
  if (!signal) return { controller, cleanup: () => undefined };

  const forwardAbort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', forwardAbort, { once: true });
  return {
    controller,
    cleanup: () => signal.removeEventListener('abort', forwardAbort),
  };
}

/**
 * Verify a CDN URL is reachable (HEAD request).
 */
async function checkUrl(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal, cache: 'force-cache' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pre-fetch a URL into browser cache and report download progress.
 * Returns the original URL (not a blob URL) so it can be used inside Web Workers.
 */
async function prefetchWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const contentLength = Number(response.headers.get('content-length') || 0);

  if (contentLength && response.body && onProgress) {
    const reader = response.body.getReader();
    let loaded = 0;
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.length;
      onProgress(loaded, contentLength);
    }
  } else {
    // Just consume the body to populate the cache
    await response.arrayBuffer();
  }
}

async function loadFFmpegCore(
  instance: FFmpeg,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let lastError: unknown = null;

  for (const baseURL of FF_CORE_CANDIDATES) {
    const { controller, cleanup } = createLinkedAbortController(signal);
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort(new Error(`Timeout loading FFmpeg core from ${baseURL}`));
    }, CDN_ATTEMPT_TIMEOUT_MS);

    try {
      controller.signal.throwIfAborted();
      onProgress?.(2);

      const coreURL = `${baseURL}/ffmpeg-core.js`;
      const wasmURL = `${baseURL}/ffmpeg-core.wasm`;

      // Verify core JS is reachable
      if (!(await checkUrl(coreURL, controller.signal))) {
        throw new Error(`Core JS not reachable: ${coreURL}`);
      }
      onProgress?.(4);
      controller.signal.throwIfAborted();

      // Pre-fetch WASM into browser cache with progress
      await prefetchWithProgress(
        wasmURL,
        (loaded, total) => {
          const pct = 4 + Math.round((loaded / total) * 10); // 4-14%
          onProgress?.(pct);
        },
        controller.signal,
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
        controller.signal.throwIfAborted();
        // Pass direct CDN URLs — the library's internal Web Worker will
        // fetch them itself. Blob URLs cause hangs because importScripts
        // from a blob-origin worker with blob URLs is unreliable.
        // UMD build has no separate worker file — only pass coreURL + wasmURL.
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
    } finally {
      clearTimeout(timeoutId);
      cleanup();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не удалось загрузить FFmpeg core');
}

function cleanup() {
  loadingPromise = null;
  ffmpeg = null;
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
  }

  ffmpeg = new FFmpeg();
  onProgress?.(1);

  loadingPromise = loadFFmpegCore(ffmpeg, onProgress, signal);

  const timeout = new Promise<never>((_, reject) => {
    globalThis.setTimeout(
      () => reject(new Error('FFmpeg долго загружается (180 с). Проверьте интернет и попробуйте снова.')),
      LOAD_TIMEOUT_MS
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
