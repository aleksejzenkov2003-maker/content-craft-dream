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

  try {
    const { videoId } = await req.json();
    if (!videoId) throw new Error('videoId is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating voiceover for video ${videoId}`);

    // Get video with advisor info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`*, advisor:advisors (id, name, elevenlabs_voice_id)`)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    const text = video.advisor_answer;
    if (!text) throw new Error('No advisor_answer text available');

    // Set status to generating
    await supabase.from('videos').update({ voiceover_status: 'generating' }).eq('id', videoId);

    const voiceId = video.advisor?.elevenlabs_voice_id || 'JBFqnCBsd6RMkjVDRZzb';

    console.log(`Calling ElevenLabs TTS, voice: ${voiceId}`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload to storage
    const fileName = `voiceovers/${videoId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) throw new Error(`Failed to upload voiceover: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
    const voiceoverUrl = urlData.publicUrl;

    // Update video record
    await supabase.from('videos').update({
      voiceover_url: voiceoverUrl,
      voiceover_status: 'ready',
    }).eq('id', videoId);

    // Log activity
    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'voiceover_generated',
      entity_type: 'video',
      entity_id: videoId,
      details: { voice_id: voiceId },
      duration_ms: durationMs,
    });

    console.log('Voiceover generated:', voiceoverUrl);

    return new Response(
      JSON.stringify({ success: true, voiceoverUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Voiceover error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Try to update status to error
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      // We need videoId but it may not be available if parsing failed
      const body = await req.clone().json().catch(() => null);
      if (body?.videoId) {
        await supabase.from('videos').update({ voiceover_status: 'error' }).eq('id', body.videoId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
