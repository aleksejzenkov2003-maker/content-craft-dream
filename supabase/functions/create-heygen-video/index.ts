import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HeyGenRequest {
  videoProjectId: string;
  script?: string;
  avatarId?: string;
  voiceId?: string;
  audioUrl?: string; // URL of pre-recorded audio from voiceover
  aspectRatio?: '16:9' | '9:16'; // Video aspect ratio
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputData: Record<string, unknown> = {};
  let outputData: Record<string, unknown> = {};

  try {
    const { videoProjectId, script, avatarId, voiceId, audioUrl, aspectRatio } = await req.json() as HeyGenRequest;
    inputData = { videoProjectId, scriptLength: script?.length || 0, avatarId, voiceId, audioUrl, aspectRatio };
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Creating HeyGen video for project ${videoProjectId}, audioUrl: ${audioUrl ? 'provided' : 'not provided'}`);

    // Update status
    await supabase
      .from('video_projects')
      .update({ status: 'generating', progress: 60 })
      .eq('id', videoProjectId);

    const selectedAvatarId = avatarId || 'Anna_public_3_20240108';

    inputData.selectedAvatarId = selectedAvatarId;

    // Build voice config - use audio URL if provided, otherwise use text-to-speech
    let voiceConfig: Record<string, unknown>;
    if (audioUrl) {
      console.log('Using audio URL for voice:', audioUrl);
      voiceConfig = {
        type: 'audio',
        audio_url: audioUrl
      };
    } else {
      const selectedVoiceId = voiceId || '1bd001e7e50f421d891986aad5158bc8';
      inputData.selectedVoiceId = selectedVoiceId;
      console.log('Using text-to-speech with voice ID:', selectedVoiceId);
      voiceConfig = {
        type: 'text',
        input_text: script,
        voice_id: selectedVoiceId
      };
    }

    // Calculate dimensions based on aspect ratio
    const selectedAspectRatio = aspectRatio || '9:16';
    const dimensions = selectedAspectRatio === '16:9' 
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };

    inputData.selectedAspectRatio = selectedAspectRatio;
    inputData.dimensions = dimensions;

    console.log(`Creating video with aspect ratio ${selectedAspectRatio}, dimensions: ${dimensions.width}x${dimensions.height}`);

    // Create video with HeyGen API v2
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: selectedAvatarId,
              avatar_style: 'normal'
            },
            voice: voiceConfig
          }
        ],
        dimension: dimensions,
        aspect_ratio: selectedAspectRatio
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen API error:', errorText);
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const heygenVideoId = result.data?.video_id;

    if (!heygenVideoId) {
      throw new Error('No video ID returned from HeyGen');
    }

    outputData.heygenVideoId = heygenVideoId;

    console.log('HeyGen video created:', heygenVideoId);

    // Update video project with HeyGen ID
    await supabase
      .from('video_projects')
      .update({ 
        heygen_video_id: heygenVideoId,
        avatar_id: selectedAvatarId,
        status: 'generating',
        progress: 70
      })
      .eq('id', videoProjectId);

    const durationMs = Date.now() - startTime;

    // Log activity with detailed data
    await supabase.from('activity_log').insert({
      action: 'heygen_video_created',
      entity_type: 'video_project',
      entity_id: videoProjectId,
      details: { heygen_video_id: heygenVideoId },
      input_data: inputData,
      output_data: outputData,
      duration_ms: durationMs
    });

    return new Response(
      JSON.stringify({ success: true, heygenVideoId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('HeyGen error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    // Log error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('activity_log').insert({
        action: 'heygen_video_error',
        entity_type: 'video_project',
        entity_id: inputData.videoProjectId as string || null,
        details: { error: errorMessage },
        input_data: inputData,
        output_data: { error: errorMessage },
        duration_ms: durationMs
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
