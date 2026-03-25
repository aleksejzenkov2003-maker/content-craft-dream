import { getSharedFFmpeg, terminateSharedFFmpeg } from './ffmpegLoader';

export type OverlayPhase = 'loading_ffmpeg' | 'downloading' | 'compositing' | 'done';

export interface OverlayProgressInfo {
  phase: OverlayPhase;
  progress: number;
}

/** Hard timeout for the ff.exec compositing step (5 minutes) */
const COMPOSITING_TIMEOUT_MS = 5 * 60 * 1000;

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

  // Collect FFmpeg log lines for diagnostics
  const ffmpegLogs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    ffmpegLogs.push(message);
    if (ffmpegLogs.length > 200) ffmpegLogs.shift();
  };
  ff.on('log', logHandler);

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 38 + Math.round(progress * 55);
    onProgress?.({ phase: 'compositing', progress: Math.max(38, Math.min(93, mapped)) });
  };
  ff.on('progress', progressHandler);

  try {
    signal?.throwIfAborted();

    // Wrap ff.exec with a hard watchdog timeout
    const execPromise = ff.exec([
      '-stream_loop', '-1', '-i', bgName,
      '-i', avatarName,
      '-filter_complex',
      [
        // Background: fill frame (no letterbox)
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,' +
          'crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1[bg]',
        // Avatar: key green + soften alpha edges
        '[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,' +
          'pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,' +
          'chromakey=0x00B140:0.30:0.08[fgk]',
        // Refine alpha (feather edges to avoid harsh outlines)
        '[fgk]split[fgc][fga]',
        '[fga]alphaextract,erosion=1,boxblur=1:1[am]',
        '[fgc][am]alphamerge[avatar]',
        // Composite
        '[bg][avatar]overlay=0:0:shortest=1[v]',
      ].join(';'),
      '-map', '[v]',
      '-map', '1:a?',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-shortest',
      '-y', outputName,
    ]);

    const watchdog = new Promise<never>((_, reject) => {
      const id = globalThis.setTimeout(() => {
        const lastLines = ffmpegLogs.slice(-10).join('\n');
        console.error('[videoOverlay] Watchdog timeout! Last FFmpeg logs:\n', lastLines);
        terminateSharedFFmpeg();
        reject(new Error(`Overlay compositing timeout (${COMPOSITING_TIMEOUT_MS / 1000}s). Last FFmpeg output:\n${lastLines}`));
      }, COMPOSITING_TIMEOUT_MS);
      signal?.addEventListener('abort', () => {
        clearTimeout(id);
        reject(signal.reason || new Error('Aborted'));
      }, { once: true });
    });

    await Promise.race([execPromise, watchdog]);

    let outputData: Uint8Array;
    try {
      const raw = await ff.readFile(outputName);
      outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
    } catch {
      const lastLines = ffmpegLogs.slice(-10).join('\n');
      throw new Error(`FFmpeg overlay не создал выходной файл. Last logs:\n${lastLines}`);
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
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('log', logHandler);
    await ff.deleteFile(avatarName).catch(() => undefined);
    await ff.deleteFile(bgName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

async function fetchAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const timeoutSignal = AbortSignal.timeout(180_000); // 3 minutes for large videos
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
  const resp = await fetch(url, { signal: combinedSignal });
  if (!resp.ok) throw new Error(`Не удалось скачать: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
