/**
 * SRT subtitle generator from ElevenLabs word timestamps.
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

/**
 * Group word timestamps into SRT blocks of N words each.
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
 * ASS format gives better control over font, colors, and positioning than SRT.
 */
export function generateAss(
  words: WordTimestamp[],
  options: {
    wordsPerBlock?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;   // ASS format: &HAABBGGRR
    outlineColor?: string;
    backColor?: string;
    outline?: number;
    shadow?: number;
    marginV?: number;
    alignment?: number; // 2 = bottom center, 8 = top center
  } = {}
): string {
  const {
    wordsPerBlock = 5,
    fontName = 'Arial',
    fontSize = 48,
    primaryColor = '&H00FFFFFF',  // white
    outlineColor = '&H00000000',  // black
    backColor = '&H80000000',     // semi-transparent black
    outline = 3,
    shadow = 0,
    marginV = 40,
    alignment = 2,
  } = options;

  const blocks = generateSrtBlocks(words, wordsPerBlock);
  
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
    const start = formatAssTime(words[(b.index - 1) * wordsPerBlock].start);
    const end = formatAssTime(words[Math.min(b.index * wordsPerBlock - 1, words.length - 1)].end);
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${b.text}`;
  });

  return header + '\n' + events.join('\n') + '\n';
}
