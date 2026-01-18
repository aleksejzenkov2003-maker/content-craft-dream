import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded voice ID for "Григорий" from professional voices
const GRIGORY_VOICE_ID = 'B7vhQtHJ3xG23dClyJE4';

interface VoiceoverRequest {
  rewriteId?: string;
  videoProjectId?: string;
  text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputData: Record<string, unknown> = {};
  let outputData: Record<string, unknown> = {};

  try {
    const { rewriteId, videoProjectId, text } = await req.json() as VoiceoverRequest;
    inputData = { rewriteId, videoProjectId, textLength: text?.length || 0, voiceId: GRIGORY_VOICE_ID };
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating voiceover with Григорий voice for ${rewriteId || videoProjectId}`);

    // Call ElevenLabs API with hardcoded Григорий voice
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${GRIGORY_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    outputData.audioSize = audioBuffer.byteLength;
    outputData.source = 'elevenlabs';
    outputData.voiceName = 'Григорий';

    // Upload to storage
    const entityId = rewriteId || videoProjectId;
    const fileName = `voiceovers/${entityId}_${Date.now()}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voiceovers')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg'
      });

    let voiceoverUrl: string;

    if (uploadError) {
      console.error('Upload error, trying media-files bucket:', uploadError);
      // Try media-files bucket as fallback
      const { data: fallbackUpload, error: fallbackError } = await supabase.storage
        .from('media-files')
        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg' });

      if (fallbackError) {
        throw new Error(`Storage upload failed: ${fallbackError.message}`);
      }
      
      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fallbackUpload.path);
      voiceoverUrl = urlData.publicUrl;
    } else {
      const { data: urlData } = supabase.storage
        .from('voiceovers')
        .getPublicUrl(uploadData.path);
      voiceoverUrl = urlData.publicUrl;
    }

    outputData.voiceoverUrl = voiceoverUrl;

    // Update the appropriate table
    if (rewriteId) {
      // Update voiceovers table
      const { data: existing } = await supabase
        .from('voiceovers')
        .select('id')
        .eq('rewritten_content_id', rewriteId)
        .single();

      if (existing) {
        await supabase
          .from('voiceovers')
          .update({
            audio_url: voiceoverUrl,
            audio_source: 'elevenlabs',
            status: 'ready',
            error_message: null
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('voiceovers')
          .insert({
            rewritten_content_id: rewriteId,
            audio_url: voiceoverUrl,
            audio_source: 'elevenlabs',
            status: 'ready'
          });
      }
    }

    if (videoProjectId) {
      await supabase
        .from('video_projects')
        .update({ 
          voiceover_url: voiceoverUrl,
          voice_id: GRIGORY_VOICE_ID,
          audio_source: 'elevenlabs',
          status: 'voiceover',
          progress: 50
        })
        .eq('id', videoProjectId);
    }

    const durationMs = Date.now() - startTime;

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'voiceover_complete',
      entity_type: rewriteId ? 'voiceover' : 'video_project',
      entity_id: rewriteId || videoProjectId,
      details: { voice_id: GRIGORY_VOICE_ID, voice_name: 'Григорий' },
      input_data: inputData,
      output_data: outputData,
      duration_ms: durationMs
    });

    console.log('Voiceover generated successfully', `(${durationMs}ms)`);

    return new Response(
      JSON.stringify({ success: true, voiceoverUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Voiceover error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
