import { fetchFile } from '@ffmpeg/util';
import { getSharedFFmpeg } from './ffmpegLoader';

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
 * Normalizes a video file's audio to AAC-LC 48kHz mono 128kbps.
 * Video stream is copied without re-encoding.
 */
export async function normalizeVideoAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  const ff = await getSharedFFmpeg((pct) => {
    onProgress?.(Math.round(pct * 0.1)); // 0-2% for loading
  });

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(2 + Math.round(progress * 98));
  };

  ff.on('progress', progressHandler);

  const uid = Date.now().toString(36);
  const inputName = `norm_in_${uid}.mp4`;
  const outputName = `norm_out_${uid}.mp4`;

  try {
    await ff.writeFile(inputName, await fetchFile(file));

    await ff.exec([
      '-i', inputName,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '1',
      '-b:a', '128k',
      '-y', outputName,
    ]);

    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    return new File([blob], file.name.replace(/\.[^.]+$/, '_normalized.mp4'), {
      type: 'video/mp4',
    });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

/**
 * Re-encodes a video from a URL using the given compression preset.
 * Falls back to DEFAULT_COMPRESSION_PRESET if none provided.
 */
export async function reduceVideoBitrate(
  videoUrl: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
  preset?: CompressionPreset,
): Promise<File> {
  const p = preset ?? DEFAULT_COMPRESSION_PRESET;

  signal?.throwIfAborted();

  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.(Math.min(15, pct)),
    signal,
  );

  signal?.throwIfAborted();

  // Download video
  onProgress?.(16);
  const resp = await fetch(videoUrl, { signal });
  if (!resp.ok) throw new Error(`Failed to download video: HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  onProgress?.(35);

  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const inputName = `reduce_in_${uid}.mp4`;
  const outputName = `reduce_out_${uid}.mp4`;

  await ff.writeFile(inputName, new Uint8Array(buf));
  onProgress?.(40);

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 40 + Math.round(progress * 55); // 40-95
    onProgress?.(Math.max(40, Math.min(95, mapped)));
  };

  ff.on('progress', progressHandler);

  try {
    signal?.throwIfAborted();

    const args = [
      '-i', inputName,
      '-vf',
      [
        `scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease`,
        `pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2`,
        'setsar=1',
      ].join(','),
      '-c:v', 'libx264',
      '-preset', p.preset,
      '-crf', String(p.crf),
      '-r', String(p.fps),
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '1',
      '-b:a', p.audioBitrate,
      ...(p.faststart ? ['-movflags', '+faststart'] : []),
      '-y', outputName,
    ];

    await ff.exec(args);

    signal?.throwIfAborted();

    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    onProgress?.(100);
    return new File([blob], 'reduced.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}
