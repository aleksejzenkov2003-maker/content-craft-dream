import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

// ── ASS subtitle generation ──

function normalizeSpaces(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

interface SrtBlock { startSec: number; endSec: number; text: string; }

function generateSmartBlocks(words: WordTimestamp[]): SrtBlock[] {
  const maxChars = 24, maxWords = 8, maxDuration = 2.4, gapSplit = 0.55;
  const blocks: SrtBlock[] = [];
  let cur: { start: number; end: number; text: string; words: number; lastEnd: number } | null = null;

  const flush = () => {
    if (!cur) return;
    const text = normalizeSpaces(cur.text);
    if (!text) { cur = null; return; }
    blocks.push({ startSec: cur.start, endSec: Math.max(cur.end, cur.start + 0.3), text });
    cur = null;
  };

  for (const w of words) {
    if (!cur) { cur = { start: w.start, end: w.end, text: w.word, words: 1, lastEnd: w.end }; continue; }
    const gap = w.start - cur.lastEnd;
    const proposedText = normalizeSpaces(cur.text + ' ' + w.word);
    const duration = w.end - cur.start;
    if (gap > gapSplit || proposedText.length > maxChars || (cur.words + 1) > maxWords || duration > maxDuration) {
      flush();
      cur = { start: w.start, end: w.end, text: w.word, words: 1, lastEnd: w.end };
    } else {
      cur.text = proposedText;
      cur.end = w.end;
      cur.words += 1;
      cur.lastEnd = w.end;
    }
  }
  flush();
  return blocks;
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function generateAss(words: WordTimestamp[]): string {
  const blocks = generateSmartBlocks(words);
  const header = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,44,&H0000CCFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,5,10,10,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = blocks.map(b =>
    `Dialogue: 0,${formatAssTime(b.startSec)},${formatAssTime(b.endSec)},Default,,0,0,0,,${b.text}`
  );

  return header + '\n' + events.join('\n') + '\n';
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch video data
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, heygen_video_url, video_path, word_timestamps, voiceover_url')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const videoUrl = video.heygen_video_url || video.video_path;
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'No video URL available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!video.word_timestamps || !Array.isArray(video.word_timestamps) || video.word_timestamps.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No word timestamps available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate ASS subtitle content
    const assContent = generateAss(video.word_timestamps as WordTimestamp[]);

    return new Response(
      JSON.stringify({
        status: 'ready',
        videoUrl,
        assContent,
        wordTimestamps: video.word_timestamps,
        videoId: video.id,
        timestampCount: video.word_timestamps.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[burn-subtitles] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
