import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { generateAss, type WordTimestamp } from './srtGenerator';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

const FF_CORE_CANDIDATES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
];

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function loadFFmpegCore(instance: FFmpeg): Promise<void> {
  let lastError: unknown = null;

  for (const baseURL of FF_CORE_CANDIDATES) {
    try {
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      await instance.load({ coreURL, wasmURL });
      return;
    } catch (error) {
      lastError = error;
      console.warn('[subtitles] Failed to load FFmpeg core from', baseURL, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Не удалось загрузить FFmpeg core');
}

async function getFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    onProgress?.(15);
    return ffmpeg;
  }

  if (loadingPromise) {
    await loadingPromise;
    return ffmpeg!;
  }

  ffmpeg = new FFmpeg();
  onProgress?.(5);

  loadingPromise = (async () => {
    await withTimeout(
      loadFFmpegCore(ffmpeg!),
      45000,
      'FFmpeg долго загружается. Проверьте интернет и попробуйте снова.'
    );
  })();

  try {
    await loadingPromise;
    onProgress?.(15);
    return ffmpeg!;
  } finally {
    if (!ffmpeg?.loaded) {
      loadingPromise = null;
      ffmpeg = null;
    }
  }
}

export interface SubtitleOptions {
  wordsPerBlock?: number;
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  outlineColor?: string;
  outline?: number;
  marginV?: number;
}

export async function burnSubtitles(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (progress: number) => void
): Promise<File> {
  const ff = await getFFmpeg(onProgress);

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 25 + Math.round(progress * 65);
    onProgress?.(Math.max(25, Math.min(90, mapped)));
  };

  ff.on('progress', progressHandler);

  try {
    onProgress?.(20);

    const assContent = generateAss(wordTimestamps, {
      wordsPerBlock: options.wordsPerBlock ?? 5,
      fontName: options.fontName ?? 'Arial',
      fontSize: options.fontSize ?? 48,
      primaryColor: options.primaryColor ?? '&H00FFFFFF',
      outlineColor: options.outlineColor ?? '&H00000000',
      outline: options.outline ?? 3,
      marginV: options.marginV ?? 40,
    });

    const inputName = 'input.mp4';
    const subsName = 'subs.ass';
    const outputName = 'output.mp4';

    const videoResponse = await withTimeout(
      fetch(videoUrl),
      45000,
      'Не удалось скачать видео для субтитров (таймаут).'
    );

    if (!videoResponse.ok) {
      throw new Error(`Не удалось скачать видео: HTTP ${videoResponse.status}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.(25);

    await ff.writeFile(inputName, new Uint8Array(videoBuffer));
    await ff.writeFile(subsName, new TextEncoder().encode(assContent));

    await ff.exec([
      '-i', inputName,
      '-vf', `ass=${subsName}`,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ]);

    onProgress?.(95);

    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(subsName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);

    onProgress?.(100);
    return new File([blob], 'video_with_subtitles.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
  }
}

