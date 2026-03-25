import { generateAss, generateSrt, generateSmartBlocks, type WordTimestamp } from './srtGenerator';
import { supabase } from '@/integrations/supabase/client';
import { callVpsFFmpeg } from './vpsClient';

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
  loading_ffmpeg: 'Подготовка сервера',
  downloading_video: 'Скачивание видео',
  burning_subtitles: 'Вшивка субтитров на сервере',
  uploading_result: 'Загрузка результата',
};

export function getPhaseLabel(phase: SubtitlePhase): string {
  return PHASE_LABELS[phase];
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

// ── Block structures for drawtext ──

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

// ── Hybrid pipeline (VPS-based) ──

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

  // Build blocks
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

  onProgress?.({ phase: 'burning_subtitles', progress: 20 });

  // Call VPS to burn subtitles
  const result = await callVpsFFmpeg('subtitles', {
    video_url: videoUrl,
    blocks,
    highlight: !!highlight,
    font_size: 56,
  });

  signal?.throwIfAborted();

  if (!result.url) throw new Error('VPS subtitles did not return a URL');

  // Update video record
  await supabase.from('videos').update({
    video_path: result.url,
  }).eq('id', videoId);

  onProgress?.({ phase: 'uploading_result', progress: 100 });
  return { videoUrl: result.url };
}

// ── Browser-only pipeline (VPS-based, same API) ──

export async function burnSubtitlesBrowser(
  videoUrl: string,
  wordTimestamps: WordTimestamp[],
  options: SubtitleOptions = {},
  onProgress?: (info: SubtitleProgressInfo) => void,
  signal?: AbortSignal,
  highlight?: boolean,
): Promise<string> {
  signal?.throwIfAborted();
  onProgress?.({ phase: 'burning_subtitles', progress: 10 });

  const smartBlocks = generateSmartBlocks(wordTimestamps);
  const blocks: TimedBlock[] = smartBlocks.map(b => ({
    startSec: b.startSec,
    endSec: b.endSec,
    text: b.text,
    words: b.words,
  }));

  if (blocks.length === 0) throw new Error('No subtitle blocks generated');

  const result = await callVpsFFmpeg('subtitles', {
    video_url: videoUrl,
    blocks,
    highlight: !!highlight,
    font_size: options.fontSize ?? 56,
  });

  signal?.throwIfAborted();
  onProgress?.({ phase: 'uploading_result', progress: 100 });

  if (!result.url) throw new Error('VPS subtitles did not return a URL');
  return result.url;
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
