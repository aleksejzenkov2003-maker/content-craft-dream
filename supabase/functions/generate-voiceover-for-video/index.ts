import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let videoId: string | null = null;

  try {
    const body = await req.json();
    videoId = body?.videoId ?? null;
    if (!videoId) throw new Error('videoId is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating voiceover for video ${videoId}`);

    // Get video with advisor info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`*, advisor:advisors (id, name, elevenlabs_voice_id, speech_speed)`)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    const text = video.advisor_answer;
    if (!text) throw new Error('No advisor_answer text available');

    // Set status to generating
    await supabase.from('videos').update({ voiceover_status: 'generating' }).eq('id', videoId);

    const voiceId = video.advisor?.elevenlabs_voice_id;
    if (!voiceId) {
      // Reset status and return error — voice ID is required
      await supabase.from('videos').update({ voiceover_status: 'error' }).eq('id', videoId);
      throw new Error('У духовника не настроен ElevenLabs Voice ID. Укажите его в настройках духовника.');
    }

    console.log(`Calling ElevenLabs TTS with-timestamps, voice: ${voiceId}`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: video.advisor?.speech_speed || 1.0 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Decode base64 audio
    const audioBase64 = result.audio_base64;
    if (!audioBase64) throw new Error('No audio_base64 in response');
    
    const binaryString = atob(audioBase64);
    const audioBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBuffer[i] = binaryString.charCodeAt(i);
    }

    // Extract word timestamps from alignment
    let wordTimestamps = null;
    if (result.alignment) {
      wordTimestamps = buildWordTimestamps(result.alignment);
      console.log(`Extracted ${wordTimestamps.length} word timestamps`);
    }

    // Upload to storage
    const fileName = `voiceovers/${videoId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) throw new Error(`Failed to upload voiceover: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
    const voiceoverUrl = urlData.publicUrl;

    // Update video record with voiceover URL and word timestamps
    const updateData: Record<string, unknown> = {
      voiceover_url: voiceoverUrl,
      voiceover_status: 'ready',
    };
    if (wordTimestamps) {
      updateData.word_timestamps = wordTimestamps;
    }
    await supabase.from('videos').update(updateData).eq('id', videoId);

    // Log activity
    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'voiceover_generated',
      entity_type: 'video',
      entity_id: videoId,
      details: { voice_id: voiceId, has_timestamps: !!wordTimestamps },
      duration_ms: durationMs,
    });

    console.log('Voiceover generated:', voiceoverUrl);

    return new Response(
      JSON.stringify({ success: true, voiceoverUrl, wordTimestamps }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Voiceover error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      if (videoId) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('videos').update({ voiceover_status: 'error' }).eq('id', videoId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build word-level timestamps from ElevenLabs character-level alignment.
 * Returns array of { word, start, end } objects.
 */
function buildWordTimestamps(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): Array<{ word: string; start: number; end: number }> {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const words: Array<{ word: string; start: number; end: number }> = [];
  
  let currentWord = '';
  let wordStart = -1;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const charStart = character_start_times_seconds[i];
    const charEnd = character_end_times_seconds[i];

    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      if (currentWord.length > 0) {
        words.push({ word: currentWord, start: wordStart, end: wordEnd });
        currentWord = '';
        wordStart = -1;
      }
    } else {
      if (wordStart < 0) wordStart = charStart;
      currentWord += char;
      wordEnd = charEnd;
    }
  }

  // Push last word
  if (currentWord.length > 0) {
    words.push({ word: currentWord, start: wordStart, end: wordEnd });
  }

  return words;
}
