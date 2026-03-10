import { fetchFile } from '@ffmpeg/util';
import { getSharedFFmpeg } from './ffmpegLoader';

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
 * Re-encodes a video from a URL with reduced bitrate (CRF 28, libx264, fast preset).
 * Returns the processed File.
 */
export async function reduceVideoBitrate(
  videoUrl: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<File> {
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

    await ff.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '28',
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '1',
      '-b:a', '128k',
      '-y', outputName,
    ]);

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
