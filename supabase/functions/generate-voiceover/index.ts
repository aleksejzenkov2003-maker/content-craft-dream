import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_VOICE_ID = 'B7vhQtHJ3xG23dClyJE4'; // Григорий fallback

interface VoiceoverRequest {
  rewriteId?: string;
  videoProjectId?: string;
  videoId?: string;
  text: string;
  voiceId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputData: Record<string, unknown> = {};
  let outputData: Record<string, unknown> = {};

  try {
    const { rewriteId, videoProjectId, videoId, text, voiceId: providedVoiceId } = await req.json() as VoiceoverRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine voice ID: provided > advisor's voice > default
    let selectedVoiceId = providedVoiceId || DEFAULT_VOICE_ID;
    
    if (!providedVoiceId && videoId) {
      // Look up advisor's voice from video
      const { data: video } = await supabase
        .from('videos')
        .select('advisor:advisors (elevenlabs_voice_id)')
        .eq('id', videoId)
        .single();
      
      if (video?.advisor?.elevenlabs_voice_id) {
        selectedVoiceId = video.advisor.elevenlabs_voice_id;
      }
    }

    inputData = { rewriteId, videoProjectId, videoId, textLength: text?.length || 0, voiceId: selectedVoiceId };

    console.log(`Generating voiceover with voice ${selectedVoiceId} for ${rewriteId || videoProjectId || videoId}`);

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
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

    // Upload to storage
    const entityId = rewriteId || videoProjectId || videoId;
    const fileName = `voiceovers/${entityId}_${Date.now()}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voiceovers')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg'
      });

    let voiceoverUrl: string;

    if (uploadError) {
      console.error('Upload error, trying media-files bucket:', uploadError);
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
          voice_id: selectedVoiceId,
          audio_source: 'elevenlabs',
          status: 'voiceover',
          progress: 50
        })
        .eq('id', videoProjectId);
    }

    if (videoId) {
      await supabase
        .from('videos')
        .update({ voiceover_url: voiceoverUrl })
        .eq('id', videoId);
    }

    const durationMs = Date.now() - startTime;

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'voiceover_complete',
      entity_type: rewriteId ? 'voiceover' : (videoId ? 'video' : 'video_project'),
      entity_id: rewriteId || videoId || videoProjectId,
      details: { voice_id: selectedVoiceId },
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
