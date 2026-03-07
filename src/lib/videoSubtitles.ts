import { generateAss, type WordTimestamp } from './srtGenerator';
import { getSharedFFmpeg } from './ffmpegLoader';

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
  const ff = await getSharedFFmpeg(onProgress);

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

    const videoResponse = await fetch(videoUrl);
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
