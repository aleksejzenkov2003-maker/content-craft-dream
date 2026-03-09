import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;
const blobUrls: string[] = [];

const FF_CORE_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
];

const CDN_ATTEMPT_TIMEOUT_MS = 60_000;
const LOAD_TIMEOUT_MS = 180_000;

function revokeBlobUrls() {
  for (const url of blobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
  }
  blobUrls.length = 0;
}

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

async function fetchToBlobUrl(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(url, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const contentLength = Number(response.headers.get('content-length') || 0);

  // Stream with progress when possible
  if (contentLength && response.body) {
    const reader = response.body.getReader();
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

  // Fallback: arrayBuffer (avoids "body stream is locked" errors)
  const buf = await response.arrayBuffer();
  const blob = new Blob([buf], {
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
    const { controller, cleanup } = createLinkedAbortController(signal);
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort(new Error(`Timeout loading FFmpeg core from ${baseURL}`));
    }, CDN_ATTEMPT_TIMEOUT_MS);

    try {
      controller.signal.throwIfAborted();
      onProgress?.(2);

      const coreURL = await fetchToBlobUrl(`${baseURL}/ffmpeg-core.js`, undefined, controller.signal);

      onProgress?.(4);
      controller.signal.throwIfAborted();

      const wasmURL = await fetchToBlobUrl(
        `${baseURL}/ffmpeg-core.wasm`,
        (loaded, total) => {
          const pct = 4 + Math.round((loaded / total) * 10); // 4-14%
          onProgress?.(pct);
        },
        controller.signal,
      );

      onProgress?.(14);
      controller.signal.throwIfAborted();

      const workerURL = await fetchToBlobUrl(
        `${baseURL}/ffmpeg-core.worker.js`,
        undefined,
        controller.signal,
      );

      onProgress?.(15);

      // Heartbeat during WASM compilation (15→20)
      let heartbeat = 15;
      const heartbeatTimer = setInterval(() => {
        if (heartbeat < 20) {
          heartbeat += 1;
          onProgress?.(heartbeat);
        }
      }, 800);

      try {
        controller.signal.throwIfAborted();
        await instance.load({ coreURL, wasmURL, workerURL });
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
