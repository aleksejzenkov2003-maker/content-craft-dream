import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface SmartSegmentOptions {
  maxChars?: number;
  maxWords?: number;
  maxDuration?: number;
  gapSplit?: number;
}

interface SrtBlock {
  startSec: number;
  endSec: number;
  text: string;
}

function normalizeSpaces(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

function generateSmartBlocks(words: WordTimestamp[], options: SmartSegmentOptions = {}): SrtBlock[] {
  const { maxChars = 24, maxWords = 8, maxDuration = 2.4, gapSplit = 0.55 } = options;
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
  const fontName = 'Montserrat';
  const fontSize = 48;
  const primaryColor = '&H00FFFFFF';
  const outlineColor = '&H00000000';
  const backColor = '&H80000000';
  const outline = 1;
  const marginV = 80;

  const header = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},1,0,0,0,100,100,0,0,1,${outline},0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = blocks.map(b => {
    return `Dialogue: 0,${formatAssTime(b.startSec)},${formatAssTime(b.endSec)},Default,,0,0,0,,${b.text}`;
  });

  return header + '\n' + events.join('\n') + '\n';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch video data
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, heygen_video_url, video_path, word_timestamps, voiceover_url')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const videoUrl = video.heygen_video_url || video.video_path;
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'No video URL available' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!video.word_timestamps || !Array.isArray(video.word_timestamps) || video.word_timestamps.length === 0) {
      return new Response(JSON.stringify({ error: 'No word timestamps available' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate ASS content
    const assContent = generateAss(video.word_timestamps as WordTimestamp[]);

    if (!n8nWebhookUrl) {
      return new Response(JSON.stringify({ error: 'N8N_WEBHOOK_URL not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send to n8n for processing
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'burn_subtitles',
        videoId: video.id,
        videoUrl,
        assContent,
        outputBucket: 'media-files',
        outputPath: `videos/${video.id}_subtitled_${Date.now()}.mp4`,
        supabaseUrl,
        serviceRoleKey,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error:', errorText);
      return new Response(JSON.stringify({ error: 'n8n webhook failed', details: errorText }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const n8nResult = await n8nResponse.json().catch(() => ({}));

    return new Response(JSON.stringify({ 
      status: 'processing',
      message: 'Subtitles sent for server-side processing',
      ...n8nResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('burn-subtitles error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
