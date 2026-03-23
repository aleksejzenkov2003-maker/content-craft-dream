import { getSharedFFmpeg } from './ffmpegLoader';

export type ConcatPhase =
  | 'loading_ffmpeg'
  | 'downloading'
  | 'normalizing'
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
  normalizing: 'Нормализация сегментов',
  creating_intro: 'Создание интро из обложки',
  concatenating: 'Склейка видео',
  done: 'Готово',
};

export function getConcatPhaseLabel(phase: ConcatPhase): string {
  return PHASE_LABELS[phase];
}

// Unified target profile for all segments
const TARGET = {
  width: 1080,
  height: 1920,
  fps: 30,
  pixFmt: 'yuv420p',
  audioRate: 48000,
  audioBitrate: '128k',
  audioChannels: 'stereo',
} as const;

const VIDEO_FILTER = [
  `scale=${TARGET.width}:${TARGET.height}:force_original_aspect_ratio=decrease`,
  `pad=${TARGET.width}:${TARGET.height}:(ow-iw)/2:(oh-ih)/2`,
  `fps=${TARGET.fps}`,
  `format=${TARGET.pixFmt}`,
  `setpts=PTS-STARTPTS`,
].join(',');

const AUDIO_FILTER = [
  `aresample=${TARGET.audioRate}:async=1:first_pts=0`,
  `aformat=sample_rates=${TARGET.audioRate}:channel_layouts=${TARGET.audioChannels}`,
  `asetpts=PTS-STARTPTS`,
].join(',');

/**
 * Normalize a single video segment to the unified profile.
 * If the segment has no audio, a silent track is injected.
 */
async function normalizeSegment(
  ff: Awaited<ReturnType<typeof getSharedFFmpeg>>,
  inputName: string,
  outputName: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();

  // First try with existing audio
  await ff.exec([
    '-i', inputName,
    '-f', 'lavfi', '-i', `anullsrc=r=${TARGET.audioRate}:cl=${TARGET.audioChannels}`,
    '-filter_complex',
    `[0:v]${VIDEO_FILTER}[vout];[0:a]${AUDIO_FILTER}[aout]`,
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-c:a', 'aac', '-ar', String(TARGET.audioRate), '-b:a', TARGET.audioBitrate,
    '-pix_fmt', TARGET.pixFmt,
    '-shortest',
    '-y', outputName,
  ]);

  // Check if output was created and has reasonable size
  let ok = false;
  try {
    const data = await ff.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    ok = bytes.length > 5000;
  } catch {
    ok = false;
  }

  if (!ok) {
    // Fallback: segment has no audio track, use silent audio from anullsrc
    console.warn(`[videoConcat] Segment ${inputName} has no audio, injecting silence`);
    await ff.deleteFile(outputName).catch(() => undefined);

    await ff.exec([
      '-i', inputName,
      '-f', 'lavfi', '-i', `anullsrc=r=${TARGET.audioRate}:cl=${TARGET.audioChannels}`,
      '-filter_complex',
      `[0:v]${VIDEO_FILTER}[vout]`,
      '-map', '[vout]', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-ar', String(TARGET.audioRate), '-b:a', TARGET.audioBitrate,
      '-pix_fmt', TARGET.pixFmt,
      '-shortest',
      '-y', outputName,
    ]);

    // Verify fallback output
    try {
      const data = await ff.readFile(outputName);
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      if (bytes.length < 5000) {
        throw new Error(`Нормализация ${inputName} не создала корректный файл`);
      }
    } catch {
      throw new Error(`Не удалось нормализовать сегмент ${inputName}`);
    }
  }
}

/**
 * Create a 2-second intro video from a front cover image,
 * already in the unified target profile.
 */
async function createIntroSegment(
  ff: Awaited<ReturnType<typeof getSharedFFmpeg>>,
  introImgName: string,
  outputName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  signal?.throwIfAborted();

  const introPromise = ff.exec([
    '-loop', '1',
    '-i', introImgName,
    '-f', 'lavfi', '-i', `anullsrc=r=${TARGET.audioRate}:cl=${TARGET.audioChannels}`,
    '-t', '2',
    '-vf', [
      `scale=${TARGET.width}:${TARGET.height}:force_original_aspect_ratio=decrease`,
      `pad=${TARGET.width}:${TARGET.height}:(ow-iw)/2:(oh-ih)/2`,
      `format=${TARGET.pixFmt}`,
    ].join(','),
    '-r', String(TARGET.fps),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-pix_fmt', TARGET.pixFmt,
    '-c:a', 'aac', '-ar', String(TARGET.audioRate), '-b:a', TARGET.audioBitrate,
    '-shortest',
    '-y', outputName,
  ]);

  const timeout = new Promise<void>((_, reject) =>
    globalThis.setTimeout(() => reject(new Error('Intro creation timeout')), 45_000)
  );

  try {
    await Promise.race([introPromise, timeout]);
    const data = await ff.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    if (bytes.length > 1000) {
      console.log('[videoConcat] Intro created:', bytes.length, 'bytes');
      return true;
    }
  } catch (err) {
    console.warn('[videoConcat] Failed to create intro:', err);
  }
  return false;
}

/**
 * Concatenates videos: optional front cover intro (2s) + main video + back cover.
 * Each segment is first normalized to a unified profile to prevent speed/sync issues.
 */
export async function concatVideosClient(
  mainVideoUrl: string,
  backCoverVideoUrl: string,
  onProgress?: (info: ConcatProgressInfo) => void,
  signal?: AbortSignal,
  frontCoverImageUrl?: string | null,
): Promise<File> {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mainRaw = `raw_main_${uid}.mp4`;
  const backRaw = `raw_back_${uid}.mp4`;
  const introImgName = `cover_${uid}.png`;
  const mainNorm = `norm_main_${uid}.mp4`;
  const backNorm = `norm_back_${uid}.mp4`;
  const introNorm = `norm_intro_${uid}.mp4`;
  const outputName = `concat_${uid}.mp4`;

  const filesToCleanup = [mainRaw, backRaw, introImgName, mainNorm, backNorm, introNorm, outputName, 'list.txt'];

  signal?.throwIfAborted();

  // 1. Load FFmpeg (0-15%)
  onProgress?.({ phase: 'loading_ffmpeg', progress: 2 });
  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(15, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  // 2. Download all assets (15-30%)
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

  onProgress?.({ phase: 'downloading', progress: 28 });
  signal?.throwIfAborted();

  // Write raw files to virtual FS
  await ff.writeFile(mainRaw, new Uint8Array(mainBuf));
  await ff.writeFile(backRaw, new Uint8Array(backBuf));
  if (frontImgBuf) {
    await ff.writeFile(introImgName, new Uint8Array(frontImgBuf));
  }
  onProgress?.({ phase: 'downloading', progress: 30 });

  try {
    // 3. Normalize each segment (30-65%)
    signal?.throwIfAborted();

    // 3a. Normalize main video
    onProgress?.({ phase: 'normalizing', progress: 32 });
    try {
      await normalizeSegment(ff, mainRaw, mainNorm, signal);
    } catch (err) {
      throw new Error(`Ошибка нормализации основного ролика: ${(err as Error).message}`);
    }
    onProgress?.({ phase: 'normalizing', progress: 45 });
    signal?.throwIfAborted();

    // 3b. Normalize back cover
    onProgress?.({ phase: 'normalizing', progress: 47 });
    try {
      await normalizeSegment(ff, backRaw, backNorm, signal);
    } catch (err) {
      throw new Error(`Ошибка нормализации задней обложки: ${(err as Error).message}`);
    }
    onProgress?.({ phase: 'normalizing', progress: 58 });
    signal?.throwIfAborted();

    // 3c. Create intro from front cover (if provided)
    let hasIntro = false;
    if (frontImgBuf) {
      onProgress?.({ phase: 'creating_intro', progress: 60 });
      hasIntro = await createIntroSegment(ff, introImgName, introNorm, signal);
      onProgress?.({ phase: 'creating_intro', progress: 65 });
    }

    signal?.throwIfAborted();

    // 4. Concat all normalized segments (65-95%)
    const segments: string[] = [];
    if (hasIntro) segments.push(introNorm);
    segments.push(mainNorm);
    segments.push(backNorm);

    onProgress?.({ phase: 'concatenating', progress: 66 });

    const progressHandler = ({ progress }: { progress: number }) => {
      const mapped = 66 + Math.round(progress * 29);
      onProgress?.({ phase: 'concatenating', progress: Math.max(66, Math.min(95, mapped)) });
    };

    ff.on('progress', progressHandler);

    try {
      signal?.throwIfAborted();

      // Since all segments are already normalized to the same profile,
      // use concat demuxer with stream copy for speed
      const listContent = segments.map(f => `file '${f}'`).join('\n');
      await ff.writeFile('list.txt', listContent);

      await ff.exec([
        '-f', 'concat', '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-y', outputName,
      ]);

      let outputData: Uint8Array | null = null;
      try {
        const raw = await ff.readFile(outputName);
        outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
      } catch {
        outputData = null;
      }

      // Fallback: if stream copy fails, re-encode
      if (!outputData || outputData.length < 10000) {
        console.warn('[videoConcat] Stream copy concat failed, falling back to re-encode');
        await ff.deleteFile(outputName).catch(() => undefined);

        const inputs: string[] = [];
        const filterParts: string[] = [];
        segments.forEach((f, idx) => {
          inputs.push('-i', f);
          filterParts.push(`[${idx}:v][${idx}:a]`);
        });

        await ff.exec([
          ...inputs,
          '-filter_complex', `${filterParts.join('')}concat=n=${segments.length}:v=1:a=1[v][a]`,
          '-map', '[v]', '-map', '[a]',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
          '-c:a', 'aac', '-ar', String(TARGET.audioRate), '-b:a', TARGET.audioBitrate,
          '-pix_fmt', TARGET.pixFmt,
          '-y', outputName,
        ]);

        try {
          const raw = await ff.readFile(outputName);
          outputData = raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw as string);
        } catch {
          throw new Error('FFmpeg concat не создал выходной файл');
        }
      }

      // Validate output
      if (!outputData || outputData.length < 10000) {
        throw new Error(`Склейка завершилась, но файл пустой или повреждён (${outputData?.length || 0} байт)`);
      }

      signal?.throwIfAborted();

      const blob = new Blob([new Uint8Array(outputData)], { type: 'video/mp4' });
      onProgress?.({ phase: 'done', progress: 100 });
      return new File([blob], 'concatenated.mp4', { type: 'video/mp4' });
    } finally {
      (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    }
  } finally {
    // Cleanup all temp files
    for (const f of filesToCleanup) {
      await ff.deleteFile(f).catch(() => undefined);
    }
  }
}

async function fetchAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Не удалось скачать: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
