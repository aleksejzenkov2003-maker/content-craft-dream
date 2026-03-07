import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { generateAss, type WordTimestamp } from './srtGenerator';

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<void> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  if (loadingPromise) {
    await loadingPromise;
    return ffmpeg!;
  }

  ffmpeg = new FFmpeg();

  loadingPromise = (async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  })();

  await loadingPromise;
  return ffmpeg!;
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

/**
 * Burns subtitles into a video using ffmpeg.wasm.
 * Downloads the video from URL, applies ASS subtitles, returns a new File.
 */
export async function burnSubtitles(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (progress: number) => void
): Promise<File> {
  const ff = await getFFmpeg();

  ff.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  // Generate ASS subtitle content
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

  // Write video and subtitle files
  await ff.writeFile(inputName, await fetchFile(videoUrl));
  await ff.writeFile(subsName, new TextEncoder().encode(assContent));

  // Burn subtitles using ASS filter
  await ff.exec([
    '-i', inputName,
    '-vf', `ass=${subsName}`,
    '-c:a', 'copy',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-y', outputName,
  ]);

  const data = await ff.readFile(outputName);
  const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

  // Cleanup
  await ff.deleteFile(inputName);
  await ff.deleteFile(subsName);
  await ff.deleteFile(outputName);

  return new File([blob], 'video_with_subtitles.mp4', { type: 'video/mp4' });
}
