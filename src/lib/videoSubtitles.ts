import { generateAss, generateSrt, generateSmartBlocks, type WordTimestamp } from './srtGenerator';
import { getSharedFFmpeg, isBrowserFFmpegSupported } from './ffmpegLoader';
import { supabase } from '@/integrations/supabase/client';

export type SubtitlePhase =
  | 'server_processing'
  | 'loading_ffmpeg'
  | 'downloading_video'
  | 'burning_subtitles'
  | 'uploading_result';

export interface SubtitleOptions {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  outlineColor?: string;
  outline?: number;
  marginV?: number;
}

export interface SubtitleProgressInfo {
  phase: SubtitlePhase;
  progress: number;
}

const PHASE_LABELS: Record<SubtitlePhase, string> = {
  server_processing: 'Подготовка субтитров',
  loading_ffmpeg: 'Загрузка FFmpeg',
  downloading_video: 'Скачивание видео',
  burning_subtitles: 'Вшивка субтитров',
  uploading_result: 'Загрузка результата',
};

export function getPhaseLabel(phase: SubtitlePhase): string {
  return PHASE_LABELS[phase];
}

// ── drawtext filter builder ──

interface TimedBlock {
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Parse ASS content (from server) back into timed blocks.
 */
function parseAssToBlocks(assContent: string): TimedBlock[] {
  const blocks: TimedBlock[] = [];
  const lines = assContent.split('\n');
  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
    // Dialogue: 0,H:MM:SS.cs,H:MM:SS.cs,Default,,0,0,0,,Text
    const parts = line.split(',');
    if (parts.length < 10) continue;
    const startStr = parts[1];
    const endStr = parts[2];
    const text = parts.slice(9).join(',').trim();
    if (!text) continue;
    blocks.push({
      startSec: parseAssTime(startStr),
      endSec: parseAssTime(endStr),
      text,
    });
  }
  return blocks;
}

function parseAssTime(str: string): number {
  // H:MM:SS.cs
  const m = str.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
}

/**
 * Escape text for FFmpeg drawtext filter.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/;/g, '\\;')
    .replace(/%/g, '%%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Build a drawtext filter chain from timed blocks.
 * Uses enable='between(t,start,end)' for each block.
 */
function buildDrawtextFilter(
  blocks: TimedBlock[],
  fontSize = 48,
  marginV = 80,
): string {
  if (blocks.length === 0) return 'null';

  const filters = blocks.map((b) => {
    const escapedText = escapeDrawtext(b.text);
    return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-${marginV}-text_h:enable='between(t,${b.startSec.toFixed(3)},${b.endSec.toFixed(3)})'`;
  });

  return filters.join(',');
}

// ── Server preparation ──

/**
 * Calls edge function to get ASS content + validated video URL from DB.
 */
export async function prepareSubtitlesServer(
  videoId: string,
): Promise<{ videoUrl: string; assContent: string }> {
  const { data, error } = await supabase.functions.invoke('burn-subtitles', {
    body: { videoId },
  });

  if (error) throw new Error(error.message || 'Server request failed');
  if (data?.error) throw new Error(data.error);

  return {
    videoUrl: data.videoUrl,
    assContent: data.assContent,
  };
}

// ── Hybrid pipeline ──

/**
 * Full pipeline: server prepares ASS → browser burns with FFmpeg drawtext → uploads result.
 */
export async function burnSubtitlesHybrid(
  videoId: string,
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
): Promise<{ videoUrl: string }> {
  // Step 1: Get ASS content from server
  onProgress?.({ phase: 'server_processing', progress: 5 });
  const { videoUrl, assContent } = await prepareSubtitlesServer(videoId);
  onProgress?.({ phase: 'server_processing', progress: 10 });

  signal?.throwIfAborted();

  // Parse ASS into timed blocks for drawtext
  const blocks = parseAssToBlocks(assContent);
  if (blocks.length === 0) throw new Error('No subtitle blocks found');
  console.log(`[subtitles] Parsed ${blocks.length} subtitle blocks`);

  // Step 2: Load FFmpeg in browser
  onProgress?.({ phase: 'loading_ffmpeg', progress: 12 });
  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(20, 10 + pct / 2) }),
    signal,
  );

  signal?.throwIfAborted();

  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const inputName = `in_${uid}.mp4`;
  const outputName = `out_${uid}.mp4`;

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 40 + Math.round(progress * 50);
    onProgress?.({ phase: 'burning_subtitles', progress: Math.max(40, Math.min(90, mapped)) });
  };

  ff.on('progress', progressHandler);

  try {
    // Step 3: Download video
    onProgress?.({ phase: 'downloading_video', progress: 22 });
    const videoResponse = await fetch(videoUrl, { signal });
    if (!videoResponse.ok) throw new Error(`Failed to download video: HTTP ${videoResponse.status}`);
    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.({ phase: 'downloading_video', progress: 35 });

    signal?.throwIfAborted();

    // Step 4: Burn subtitles with drawtext filter
    await ff.writeFile(inputName, new Uint8Array(videoBuffer));
    onProgress?.({ phase: 'burning_subtitles', progress: 40 });

    const vf = buildDrawtextFilter(blocks);
    console.log(`[subtitles] drawtext filter length: ${vf.length} chars`);

    const exitCode = await ff.exec([
      '-i', inputName,
      '-vf', vf,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    signal?.throwIfAborted();

    // Step 5: Upload result
    onProgress?.({ phase: 'uploading_result', progress: 92 });
    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });
    const file = new File([blob], 'video_with_subtitles.mp4', { type: 'video/mp4' });

    const fileName = `videos/${videoId}_subtitled_${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, file, { contentType: 'video/mp4', upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
    onProgress?.({ phase: 'uploading_result', progress: 100 });

    return { videoUrl: urlData.publicUrl };
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

// ── Browser-only pipeline ──

/**
 * Tier 2: Browser-only subtitle burning (no server call).
 */
export async function burnSubtitlesBrowser(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
): Promise<File> {
  if (!isBrowserFFmpegSupported()) {
    throw new Error('Браузер не поддерживает FFmpeg WASM');
  }

  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const inputName = `in_${uid}.mp4`;
  const outputName = `out_${uid}.mp4`;

  signal?.throwIfAborted();
  onProgress?.({ phase: 'loading_ffmpeg', progress: 5 });

  const ff = await getSharedFFmpeg(
    (pct) => onProgress?.({ phase: 'loading_ffmpeg', progress: Math.min(20, pct) }),
    signal,
  );

  signal?.throwIfAborted();

  const progressHandler = ({ progress }: { progress: number }) => {
    const mapped = 40 + Math.round(progress * 50);
    onProgress?.({ phase: 'burning_subtitles', progress: Math.max(40, Math.min(90, mapped)) });
  };

  ff.on('progress', progressHandler);

  try {
    onProgress?.({ phase: 'downloading_video', progress: 22 });

    // Build timed blocks from word timestamps
    const srtBlocks = generateSmartBlocks(wordTimestamps);
    const blocks: TimedBlock[] = srtBlocks.map(b => ({
      startSec: b.startSec,
      endSec: b.endSec,
      text: b.text,
    }));

    if (blocks.length === 0) throw new Error('No subtitle blocks generated');

    signal?.throwIfAborted();

    const videoResponse = await fetch(videoUrl, { signal });
    if (!videoResponse.ok) throw new Error(`Не удалось скачать видео: HTTP ${videoResponse.status}`);

    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.({ phase: 'downloading_video', progress: 35 });

    signal?.throwIfAborted();

    await ff.writeFile(inputName, new Uint8Array(videoBuffer));

    onProgress?.({ phase: 'burning_subtitles', progress: 40 });

    const vf = buildDrawtextFilter(
      blocks,
      options.fontSize ?? 48,
      options.marginV ?? 80,
    );

    const exitCode = await ff.exec([
      '-i', inputName,
      '-vf', vf,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    signal?.throwIfAborted();
    onProgress?.({ phase: 'uploading_result', progress: 92 });

    const data = await ff.readFile(outputName);
    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const blob = new Blob([new Uint8Array(uint8)], { type: 'video/mp4' });

    onProgress?.({ phase: 'uploading_result', progress: 100 });
    return new File([blob], 'video_with_subtitles.mp4', { type: 'video/mp4' });
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('progress', progressHandler);
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
  }
}

// ── Fallback: download subtitle file ──

/**
 * Tier 3: Download SRT/ASS file as fallback.
 */
export function downloadSubtitleFile(
  wordTimestamps: WordTimestamp[],
  format: 'srt' | 'ass' = 'srt',
): void {
  const content = format === 'ass'
    ? generateAss(wordTimestamps, { useSmartBlocks: true })
    : generateSrt(wordTimestamps);
  const ext = format;
  const mime = format === 'ass' ? 'text/x-ssa' : 'text/srt';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subtitles.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Legacy export
export const burnSubtitles = burnSubtitlesBrowser;
