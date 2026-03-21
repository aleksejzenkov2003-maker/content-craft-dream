import { generateAss, generateSrt, generateSmartBlocks, type WordTimestamp } from './srtGenerator';
import { getSharedFFmpeg, isBrowserFFmpegSupported } from './ffmpegLoader';
import { supabase } from '@/integrations/supabase/client';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

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

// ── Font management ──

let fontData: Uint8Array | null = null;
const FONT_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@5.1.0/latin-900-normal.ttf';
const FONT_PATH = 'Montserrat-Black.ttf';

async function ensureFont(ff: FFmpeg): Promise<void> {
  if (!fontData) {
    const resp = await fetch(FONT_URL);
    if (!resp.ok) throw new Error(`Failed to fetch font: HTTP ${resp.status}`);
    fontData = new Uint8Array(await resp.arrayBuffer());
  }
  await ff.writeFile(FONT_PATH, fontData);
}

// ── drawtext filter builder ──

interface TimedBlock {
  startSec: number;
  endSec: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

function parseAssToBlocks(assContent: string): TimedBlock[] {
  const blocks: TimedBlock[] = [];
  const lines = assContent.split('\n');
  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
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
  const m = str.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
}

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

function buildDrawtextFilter(
  blocks: TimedBlock[],
  fontSize = 56,
  _marginV = 160,
): string {
  if (blocks.length === 0) return 'null';

  const filters = blocks.map((b) => {
    const escapedText = escapeDrawtext(b.text);
    return `drawtext=fontfile=${FONT_PATH}:text='${escapedText}':fontsize=${fontSize}:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h*0.55):enable='between(t,${b.startSec.toFixed(3)},${b.endSec.toFixed(3)})'`;
  });

  return filters.join(',');
}

// ── Highlight (karaoke) drawtext filter ──
// Shows one word at a time, centered, yellow. No overlay alignment needed.

function buildHighlightDrawtextFilter(
  blocks: TimedBlock[],
  fontSize = 56,
): string {
  if (blocks.length === 0) return 'null';
  const filters: string[] = [];

  for (const b of blocks) {
    const escaped = escapeDrawtext(b.text);
    filters.push(
      `drawtext=fontfile=${FONT_PATH}:text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h*0.55):enable='between(t,${b.startSec.toFixed(3)},${b.endSec.toFixed(3)})'`
    );
  }

  return filters.join(',');
}

// ── FFmpeg exec with log capture ──

async function execWithLogs(
  ff: FFmpeg,
  args: string[],
): Promise<void> {
  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => logs.push(message);
  ff.on('log', logHandler);

  try {
    const exitCode = await ff.exec(args);
    if (exitCode !== 0) {
      const tail = logs.slice(-5).join(' | ');
      console.error('[ffmpeg logs]', logs.join('\n'));
      throw new Error(`FFmpeg error (code ${exitCode}): ${tail}`);
    }
  } finally {
    (ff as unknown as { off?: (event: string, cb: unknown) => void }).off?.('log', logHandler);
  }
}

// ── Server preparation ──

export async function prepareSubtitlesServer(
  videoId: string,
): Promise<{ videoUrl: string; assContent: string; wordTimestamps?: WordTimestamp[] }> {
  const { data, error } = await supabase.functions.invoke('burn-subtitles', {
    body: { videoId },
  });

  if (error) throw new Error(error.message || 'Server request failed');
  if (data?.error) throw new Error(data.error);

  return {
    videoUrl: data.videoUrl,
    assContent: data.assContent,
    wordTimestamps: data.wordTimestamps,
  };
}

// ── Hybrid pipeline ──

export async function burnSubtitlesHybrid(
  videoId: string,
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
  highlight?: boolean,
): Promise<{ videoUrl: string }> {
  onProgress?.({ phase: 'server_processing', progress: 5 });
  const { videoUrl, assContent, wordTimestamps } = await prepareSubtitlesServer(videoId);
  onProgress?.({ phase: 'server_processing', progress: 10 });

  signal?.throwIfAborted();

  // If highlight mode and we have word timestamps, use smart blocks with word data
  let blocks: TimedBlock[];
  if (highlight && wordTimestamps && wordTimestamps.length > 0) {
    const smartBlocks = generateSmartBlocks(wordTimestamps);
    blocks = smartBlocks.map(b => ({
      startSec: b.startSec,
      endSec: b.endSec,
      text: b.text,
      words: b.words,
    }));
  } else {
    blocks = parseAssToBlocks(assContent);
  }
  if (blocks.length === 0) throw new Error('No subtitle blocks found');
  console.log(`[subtitles] ${highlight ? 'Highlight' : 'Normal'} mode, ${blocks.length} blocks`);

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
    // Download font
    onProgress?.({ phase: 'downloading_video', progress: 21 });
    await ensureFont(ff);

    // Download video
    onProgress?.({ phase: 'downloading_video', progress: 22 });
    const videoResponse = await fetch(videoUrl, { signal });
    if (!videoResponse.ok) throw new Error(`Failed to download video: HTTP ${videoResponse.status}`);
    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.({ phase: 'downloading_video', progress: 35 });

    signal?.throwIfAborted();

    await ff.writeFile(inputName, new Uint8Array(videoBuffer));

    // Build drawtext filter
    const vf = highlight ? buildHighlightDrawtextFilter(blocks) : buildDrawtextFilter(blocks);
    console.log(`[subtitles] drawtext filter length: ${vf.length} chars, filters: ${vf.split(',drawtext=').length}`);

    onProgress?.({ phase: 'burning_subtitles', progress: 40 });

    await execWithLogs(ff, [
      '-i', inputName,
      '-vf', vf,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ]);

    signal?.throwIfAborted();

    // Upload result
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
    await ff.deleteFile(FONT_PATH).catch(() => undefined);
  }
}

// ── Browser-only pipeline ──

export async function burnSubtitlesBrowser(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
  highlight?: boolean,
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
    // Download font
    console.log('[subtitles] Loading font...');
    await ensureFont(ff);
    console.log('[subtitles] Font loaded OK');

    onProgress?.({ phase: 'downloading_video', progress: 22 });

    console.log(`[subtitles] Generating blocks from ${wordTimestamps.length} word timestamps, highlight=${highlight}`);
    const srtBlocks = generateSmartBlocks(wordTimestamps);
    const blocks: TimedBlock[] = srtBlocks.map(b => ({
      startSec: b.startSec,
      endSec: b.endSec,
      text: b.text,
      words: b.words,
    }));

    console.log(`[subtitles] Generated ${blocks.length} blocks`);
    if (blocks.length === 0) throw new Error('No subtitle blocks generated');

    signal?.throwIfAborted();

    const videoResponse = await fetch(videoUrl, { signal });
    if (!videoResponse.ok) throw new Error(`Не удалось скачать видео: HTTP ${videoResponse.status}`);

    const videoBuffer = await videoResponse.arrayBuffer();
    onProgress?.({ phase: 'downloading_video', progress: 35 });

    signal?.throwIfAborted();

    await ff.writeFile(inputName, new Uint8Array(videoBuffer));

    // Build drawtext filter
    const fontSize = options.fontSize ?? 36;
    const vf = highlight
      ? buildHighlightDrawtextFilter(blocks, fontSize)
      : buildDrawtextFilter(blocks, fontSize, options.marginV ?? 160);

    console.log(`[subtitles] Filter built: fontSize=${fontSize}, filterLength=${vf.length}, filters=${vf.split(',drawtext=').length}`);
    onProgress?.({ phase: 'burning_subtitles', progress: 40 });

    const ffArgs = [
      '-i', inputName,
      '-vf', vf,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y', outputName,
    ];
    console.log('[subtitles] Running FFmpeg...');
    await execWithLogs(ff, ffArgs);
    console.log('[subtitles] FFmpeg completed OK');

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
    await ff.deleteFile(FONT_PATH).catch(() => undefined);
  }
}

// ── Fallback: download subtitle file ──

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
