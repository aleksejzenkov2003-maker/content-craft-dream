import { getSharedFFmpeg } from './ffmpegLoader';

export type OverlayPhase = 'loading_ffmpeg' | 'downloading' | 'compositing' | 'done';

export interface OverlayProgressInfo {
  phase: OverlayPhase;
  progress: number;
}

/**
 * Overlays an avatar video (with green screen background) onto a background video.
 * Uses FFmpeg chromakey filter to remove green, then overlay to composite.
 */
export async function overlayAvatarOnBackground(
  avatarVideoUrl: string,
  backgroundVideoUrl: string,
  onProgress?: (info: OverlayProgressInfo) => void,
  signal?: AbortSignal,
): Promise<File> {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const avatarName = `avatar_${uid}.mp4`;
  const bgName = `bg_${uid}.mp4`;
  const outputName = `overlay_${uid}.mp4`;

  signal?.throwIfAborted();

  // 1. Load FFmpeg (0-15%)
  onProgress?.({ phase: 'loading_ffmpeg', progress: 2 });
  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(15, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  // 2. Download both videos (15-35%)
  onProgress?.({ phase: 'downloading', progress: 16 });
  const [avatarBuf, bgBuf] = await Promise.all([
    fetchAsset(avatarVideoUrl, signal),
    fetchAsset(backgroundVideoUrl, signal),
  ]);
  onProgress?.({ phase: 'downloading', progress: 34 });
  signal?.throwIfAborted();

  // 3. Write to virtual FS
  await ff.writeFile(avatarName, new Uint8Array(avatarBuf));
  await ff.writeFile(bgName, new Uint8Array(bgBuf));
  onProgress?.({ phase: 'downloading', progress: 36 });

  // 4. Composite: loop background to match avatar duration, chromakey green, overlay
  onProgress?.({ phase: 'compositing', progress: 38 });

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 38 + Math.round(progress * 55);
    onProgress?.({ phase: 'compositing', progress: Math.max(38, Math.min(93, mapped)) });
  };
  ff.on('progress', progressHandler);

  try {
    signal?.throwIfAborted();

    // Filter:
    // - [0] = background video
    // - [1] = avatar video with solid green background from HeyGen
    // We keep the original HeyGen clip intact and composite a processed copy.
    await ff.exec([
      '-i', bgName,
      '-i', avatarName,
      '-filter_complex',
      [
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1[bg]',
        '[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x00B140,setsar=1,format=rgba,chromakey=0x00B140:0.11:0.04[avatar]',
        '[bg][avatar]overlay=0:0:format=auto[v]',
      ].join(';'),
      '-map', '[v]',
      '-map', '1:a?',                           // optional avatar audio track
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-shortest',                               // stop at the shorter of the two inputs
      '-y', outputName,
    ]);

    let outputData: Uint8Array;
    try {
      const raw = await ff.readFile(outputName);
      outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
    } catch {
      throw new Error('FFmpeg overlay не создал выходной файл');
    }

    if (outputData.length < 10000) {
      throw new Error(`Overlay завершился, но файл пустой (${outputData.length} байт)`);
    }

    signal?.throwIfAborted();
    const blob = new Blob([new Uint8Array(outputData)], { type: 'video/mp4' });
    onProgress?.({ phase: 'done', progress: 100 });
    return new File([blob], 'overlay_result.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(avatarName).catch(() => undefined);
    await ff.deleteFile(bgName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

async function fetchAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  // Combine user signal with a 60-second timeout to prevent hanging on expired URLs
  const timeoutSignal = AbortSignal.timeout(60_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
  const resp = await fetch(url, { signal: combinedSignal });
  if (!resp.ok) throw new Error(`Не удалось скачать: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
