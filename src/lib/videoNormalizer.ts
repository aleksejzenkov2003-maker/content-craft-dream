import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

/**
 * Normalizes a video file's audio to AAC-LC 48kHz mono 128kbps.
 * Video stream is copied without re-encoding.
 * Returns a new File with normalized audio.
 */
export async function normalizeVideoAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  const ff = await getFFmpeg();

  ff.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

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

  // Cleanup
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  return new File([blob], file.name.replace(/\.[^.]+$/, '_normalized.mp4'), {
    type: 'video/mp4',
  });
}
