import { callVpsFFmpeg } from './vpsClient';

export interface CompressionPreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  crf: number;
  preset: string;
  fps: number;
  audioBitrate: string;
  faststart: boolean;
}

export const COMPRESSION_PRESETS: CompressionPreset[] = [
  {
    id: 'light',
    label: 'Light Compress (~2x)',
    description: '1080×1920 · CRF 24 · slow · 30fps · 128k audio',
    width: 1080, height: 1920, crf: 24, preset: 'slow', fps: 30, audioBitrate: '128k', faststart: true,
  },
  {
    id: 'balanced',
    label: 'Balanced Social (~3x)',
    description: '900×1600 · CRF 26 · medium · 24fps · 96k audio',
    width: 900, height: 1600, crf: 26, preset: 'medium', fps: 24, audioBitrate: '96k', faststart: true,
  },
  {
    id: 'compact',
    label: 'Compact Social (~4x)',
    description: '720×1280 · CRF 28 · medium · 24fps · 96k audio',
    width: 720, height: 1280, crf: 28, preset: 'medium', fps: 24, audioBitrate: '96k', faststart: true,
  },
  {
    id: 'very_compact',
    label: 'Very Compact (~5x)',
    description: '720×1280 · CRF 30 · medium · 20fps · 64k audio',
    width: 720, height: 1280, crf: 30, preset: 'medium', fps: 20, audioBitrate: '64k', faststart: true,
  },
  {
    id: 'max_social',
    label: 'Max Social (~6x)',
    description: '540×960 · CRF 31 · slow · 20fps · 64k audio',
    width: 540, height: 960, crf: 31, preset: 'slow', fps: 20, audioBitrate: '64k', faststart: true,
  },
];

export const DEFAULT_COMPRESSION_PRESET = COMPRESSION_PRESETS[1]; // balanced

/**
 * Normalizes a video file's audio via VPS.
 */
export async function normalizeVideoAudio(
  videoUrl: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(10);

  const result = await callVpsFFmpeg('normalize-audio', {
    video_url: videoUrl,
  });

  onProgress?.(100);
  if (!result.url) throw new Error('VPS normalize-audio did not return a URL');
  return result.url;
}

/**
 * Re-encodes a video from a URL using the given compression preset via VPS.
 */
export async function reduceVideoBitrate(
  videoUrl: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
  preset?: CompressionPreset,
): Promise<string> {
  const p = preset ?? DEFAULT_COMPRESSION_PRESET;
  signal?.throwIfAborted();

  onProgress?.(10);

  const result = await callVpsFFmpeg('reduce', {
    video_url: videoUrl,
    preset: {
      width: p.width,
      height: p.height,
      crf: p.crf,
      preset: p.preset,
      fps: p.fps,
      audioBitrate: p.audioBitrate,
    },
  });

  signal?.throwIfAborted();
  onProgress?.(100);

  if (!result.url) throw new Error('VPS reduce did not return a URL');
  return result.url;
}
