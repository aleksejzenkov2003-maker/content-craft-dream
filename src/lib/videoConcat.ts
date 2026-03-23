import { getSharedFFmpeg } from './ffmpegLoader';

export type ConcatPhase =
  | 'loading_ffmpeg'
  | 'downloading'
  | 'creating_intro'
  | 'concatenating'
  | 'done';

export interface ConcatProgressInfo {
  phase: ConcatPhase;
  progress: number;
}

const PHASE_LABELS: Record<ConcatPhase, string> = {
  loading_ffmpeg: 'Загрузка FFmpeg',
  downloading: 'Скачивание видео',
  creating_intro: 'Создание интро из обложки',
  concatenating: 'Склейка видео',
  done: 'Готово',
};

export function getConcatPhaseLabel(phase: ConcatPhase): string {
  return PHASE_LABELS[phase];
}

/**
 * Concatenates videos: optional front cover intro (2s) + main video + back cover.
 */
export async function concatVideosClient(
  mainVideoUrl: string,
  backCoverVideoUrl: string,
  onProgress?: (info: ConcatProgressInfo) => void,
  signal?: AbortSignal,
  frontCoverImageUrl?: string | null,
): Promise<File> {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mainName = `main_${uid}.mp4`;
  const backName = `back_${uid}.mp4`;
  const introName = `intro_${uid}.mp4`;
  const introImgName = `cover_${uid}.png`;
  const outputName = `concat_${uid}.mp4`;

  signal?.throwIfAborted();

  // 1. Load ffmpeg (0-15%)
  onProgress?.({ phase: 'loading_ffmpeg', progress: 2 });
  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(15, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  // 2. Download all assets (15-40%)
  onProgress?.({ phase: 'downloading', progress: 16 });

  const downloads: Promise<ArrayBuffer>[] = [
    fetchAsset(mainVideoUrl, signal),
    fetchAsset(backCoverVideoUrl, signal),
  ];
  if (frontCoverImageUrl) {
    downloads.push(fetchAsset(frontCoverImageUrl, signal));
  }

  const results = await Promise.all(downloads);
  const mainBuf = results[0];
  const backBuf = results[1];
  const frontImgBuf = results[2] || null;

  onProgress?.({ phase: 'downloading', progress: 38 });
  signal?.throwIfAborted();

  // 3. Write main + back to virtual FS
  await ff.writeFile(mainName, new Uint8Array(mainBuf));
  await ff.writeFile(backName, new Uint8Array(backBuf));
  onProgress?.({ phase: 'downloading', progress: 40 });

  // 4. Create 2-second intro video from front cover image (if provided)
  let hasIntro = false;
  if (frontImgBuf) {
    onProgress?.({ phase: 'creating_intro', progress: 42 });
    await ff.writeFile(introImgName, new Uint8Array(frontImgBuf));

    try {
      // Scale image down and encode with timeout to avoid hanging in WASM
      const introPromise = ff.exec([
        '-loop', '1',
        '-i', introImgName,
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono',
        '-t', '2',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-r', '15',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
        '-shortest',
        '-y', introName,
      ]);

      const introTimeout = new Promise<void>((_, reject) =>
        globalThis.setTimeout(() => reject(new Error('Intro creation timeout')), 45_000)
      );

      await Promise.race([introPromise, introTimeout]);

      // Verify intro was created
      try {
        const introData = await ff.readFile(introName);
        const introBytes = introData instanceof Uint8Array ? introData : new TextEncoder().encode(introData as string);
        if (introBytes.length > 1000) {
          hasIntro = true;
          console.log('[videoConcat] Intro created successfully:', introBytes.length, 'bytes');
        }
      } catch {
        console.warn('[videoConcat] Intro file not created, skipping front cover');
      }
    } catch (err) {
      console.warn('[videoConcat] Failed to create intro from front cover:', err);
    }
    onProgress?.({ phase: 'creating_intro', progress: 48 });
  }

  signal?.throwIfAborted();

  // 5. Build concat list
  const parts: string[] = [];
  if (hasIntro) parts.push(`file '${introName}'`);
  parts.push(`file '${mainName}'`);
  parts.push(`file '${backName}'`);

  await ff.writeFile('list.txt', parts.join('\n'));
  onProgress?.({ phase: 'concatenating', progress: 50 });

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 50 + Math.round(progress * 45);
    onProgress?.({ phase: 'concatenating', progress: Math.max(50, Math.min(95, mapped)) });
  };

  ff.on('progress', progressHandler);

  try {
    signal?.throwIfAborted();

    // If we have an intro (re-encoded), we must re-encode the whole thing for compatibility
    if (hasIntro) {
      await ff.exec([
        '-f', 'concat', '-safe', '0',
        '-i', 'list.txt',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
        '-y', outputName,
      ]);
    } else {
      // No intro — try stream copy first (fast path)
      await ff.exec([
        '-f', 'concat', '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-y', outputName,
      ]);
    }

    let outputData: Uint8Array | null = null;
    try {
      const raw = await ff.readFile(outputName);
      outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
    } catch {
      outputData = null;
    }

    // Fallback: full re-encode
    if (!outputData || outputData.length < 10000) {
      console.warn('Primary concat failed, falling back to filter_complex re-encode...');
      await ff.deleteFile(outputName).catch(() => undefined);

      // Build inputs and filter for all parts
      const inputs: string[] = [];
      const filterParts: string[] = [];
      let idx = 0;

      if (hasIntro) {
        inputs.push('-i', introName);
        filterParts.push(`[${idx}:v][${idx}:a]`);
        idx++;
      }
      inputs.push('-i', mainName);
      filterParts.push(`[${idx}:v][${idx}:a]`);
      idx++;
      inputs.push('-i', backName);
      filterParts.push(`[${idx}:v][${idx}:a]`);
      idx++;

      await ff.exec([
        ...inputs,
        '-filter_complex', `${filterParts.join('')}concat=n=${idx}:v=1:a=1[v][a]`,
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
        '-y', outputName,
      ]);

      try {
        const raw = await ff.readFile(outputName);
        outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
      } catch {
        throw new Error('FFmpeg concat не создал выходной файл');
      }
    }

    if (!outputData || outputData.length < 10000) {
      throw new Error(`Склейка завершилась, но файл пустой (${outputData?.length || 0} байт)`);
    }

    signal?.throwIfAborted();

    const blob = new Blob([new Uint8Array(outputData)], { type: 'video/mp4' });

    onProgress?.({ phase: 'done', progress: 100 });
    return new File([blob], 'concatenated.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(mainName).catch(() => undefined);
    await ff.deleteFile(backName).catch(() => undefined);
    await ff.deleteFile(introName).catch(() => undefined);
    await ff.deleteFile(introImgName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
    await ff.deleteFile('list.txt').catch(() => undefined);
  }
}

async function fetchAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Не удалось скачать: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
