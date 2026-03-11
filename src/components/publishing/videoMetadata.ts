export interface PublicationVideoMetadata {
  durationSeconds: number | null;
  sizeBytes: number | null;
}

const durationCache = new Map<string, Promise<number | null>>();
const sizeCache = new Map<string, Promise<number | null>>();

function loadMediaDuration(url: string, tagName: 'video' | 'audio'): Promise<number | null> {
  const cached = durationCache.get(`${tagName}:${url}`);
  if (cached) return cached;

  const promise = new Promise<number | null>((resolve) => {
    const media = document.createElement(tagName);
    let settled = false;

    const cleanup = () => {
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('error', handleError);
      media.removeAttribute('src');
      media.load();
    };

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleLoadedMetadata = () => {
      const duration = media.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };

    const handleError = () => finish(null);

    media.preload = 'metadata';
    media.crossOrigin = 'anonymous';
    media.muted = true;
    if (tagName === 'video') {
      (media as HTMLVideoElement).playsInline = true;
    }
    media.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    media.addEventListener('error', handleError, { once: true });
    media.src = url;

    window.setTimeout(() => finish(null), 12000);
  });

  durationCache.set(`${tagName}:${url}`, promise);
  return promise;
}

async function loadFileSize(url: string): Promise<number | null> {
  const cached = sizeCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength) {
        const parsed = Number(contentLength);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore and try range request
    }

    try {
      const rangeResponse = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });

      const contentRange = rangeResponse.headers.get('content-range');
      if (contentRange) {
        const total = Number(contentRange.split('/').pop());
        if (Number.isFinite(total) && total > 0) return total;
      }

      const contentLength = rangeResponse.headers.get('content-length');
      if (contentLength) {
        const parsed = Number(contentLength);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore
    }

    return null;
  })();

  sizeCache.set(url, promise);
  return promise;
}

export async function resolvePublicationVideoMetadata({
  videoUrl,
  audioUrl,
}: {
  videoUrl?: string | null;
  audioUrl?: string | null;
}): Promise<PublicationVideoMetadata> {
  const [videoDuration, sizeBytes] = await Promise.all([
    videoUrl ? loadMediaDuration(videoUrl, 'video') : Promise.resolve<number | null>(null),
    videoUrl ? loadFileSize(videoUrl) : Promise.resolve<number | null>(null),
  ]);

  const durationSeconds = videoDuration ?? (audioUrl ? await loadMediaDuration(audioUrl, 'audio') : null);

  return {
    durationSeconds,
    sizeBytes,
  };
}

export function formatFileSize(sizeBytes: number | null | undefined): string {
  if (!sizeBytes || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}
