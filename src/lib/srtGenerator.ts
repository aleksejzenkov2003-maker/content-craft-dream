/**
 * SRT/ASS subtitle generator from ElevenLabs word timestamps.
 */

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SrtBlock {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  /** Original start in seconds (for ASS time formatting) */
  startSec: number;
  /** Original end in seconds */
  endSec: number;
  /** Original word-level timestamps within this block (for highlight mode) */
  words: WordTimestamp[];
}

export interface SmartSegmentOptions {
  maxChars?: number;
  maxWords?: number;
  maxDuration?: number;
  gapSplit?: number;
}

/**
 * Format seconds to SRT time format: HH:MM:SS,mmm
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function normalizeSpaces(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Smart segmentation ported from n8n workflow.
 * Groups words adaptively based on character count, word count, duration, and gaps.
 */
export function generateSmartBlocks(
  words: WordTimestamp[],
  options: SmartSegmentOptions = {}
): SrtBlock[] {
  const {
    maxChars = 24,
    maxWords = 8,
    maxDuration = 2.4,
    gapSplit = 0.55,
  } = options;

  const blocks: SrtBlock[] = [];

  let cur: { start: number; end: number; text: string; words: number; lastEnd: number } | null = null;

  const flush = () => {
    if (!cur) return;
    const text = normalizeSpaces(cur.text);
    if (!text) { cur = null; return; }
    blocks.push({
      index: blocks.length + 1,
      startTime: formatSrtTime(cur.start),
      endTime: formatSrtTime(Math.max(cur.end, cur.start + 0.3)),
      startSec: cur.start,
      endSec: Math.max(cur.end, cur.start + 0.3),
      text,
    });
    cur = null;
  };

  for (const w of words) {
    const t = w.word;
    const start = w.start;
    const end = w.end;

    if (!cur) {
      cur = { start, end, text: t, words: 1, lastEnd: end };
      continue;
    }

    const gap = start - cur.lastEnd;
    const proposedText = normalizeSpaces(cur.text + ' ' + t);
    const duration = end - cur.start;

    const shouldSplit =
      gap > gapSplit ||
      proposedText.length > maxChars ||
      (cur.words + 1) > maxWords ||
      duration > maxDuration;

    if (shouldSplit) {
      flush();
      cur = { start, end, text: t, words: 1, lastEnd: end };
    } else {
      cur.text = proposedText;
      cur.end = end;
      cur.words += 1;
      cur.lastEnd = end;
    }
  }

  flush();
  return blocks;
}

/**
 * Group word timestamps into SRT blocks of N words each (legacy, kept for backward compat).
 */
export function generateSrtBlocks(
  words: WordTimestamp[],
  wordsPerBlock: number = 5
): SrtBlock[] {
  const blocks: SrtBlock[] = [];
  
  for (let i = 0; i < words.length; i += wordsPerBlock) {
    const chunk = words.slice(i, i + wordsPerBlock);
    if (chunk.length === 0) continue;

    const blockStart = chunk[0].start;
    const blockEnd = chunk[chunk.length - 1].end;
    const text = chunk.map(w => w.word).join(' ');

    blocks.push({
      index: blocks.length + 1,
      startTime: formatSrtTime(blockStart),
      endTime: formatSrtTime(blockEnd),
      startSec: blockStart,
      endSec: blockEnd,
      text,
    });
  }

  return blocks;
}

/**
 * Generate SRT file content from word timestamps.
 */
export function generateSrt(
  words: WordTimestamp[],
  wordsPerBlock: number = 5
): string {
  const blocks = generateSrtBlocks(words, wordsPerBlock);
  return blocks
    .map(b => `${b.index}\n${b.startTime} --> ${b.endTime}\n${b.text}\n`)
    .join('\n');
}

/**
 * Generate ASS subtitle content with styled subtitles.
 * Uses smart segmentation by default.
 */
export function generateAss(
  words: WordTimestamp[],
  options: {
    wordsPerBlock?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    outlineColor?: string;
    backColor?: string;
    outline?: number;
    shadow?: number;
    marginV?: number;
    alignment?: number;
    useSmartBlocks?: boolean;
    smartOptions?: SmartSegmentOptions;
  } = {}
): string {
  const {
    fontName = 'Montserrat',
    fontSize = 48,
    primaryColor = '&H00FFFFFF',
    outlineColor = '&H00000000',
    backColor = '&H80000000',
    outline = 1,
    shadow = 0,
    marginV = 80,
    alignment = 2,
    useSmartBlocks = true,
    smartOptions,
    wordsPerBlock = 5,
  } = options;

  const blocks = useSmartBlocks
    ? generateSmartBlocks(words, smartOptions)
    : generateSrtBlocks(words, wordsPerBlock);
  
  const header = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},1,0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const formatAssTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.round((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const events = blocks.map(b => {
    const start = formatAssTime(b.startSec);
    const end = formatAssTime(b.endSec);
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${b.text}`;
  });

  return header + '\n' + events.join('\n') + '\n';
}
