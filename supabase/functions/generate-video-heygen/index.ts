import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  videoId: string;
  photoAssetId: string;
  script: string;
  voiceId?: string;
  aspectRatio?: '16:9' | '9:16';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { videoId, photoAssetId, script, voiceId, aspectRatio } = await req.json() as GenerateRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating HeyGen video for video ${videoId}, photoAssetId: ${photoAssetId}`);

    // Get video with advisor info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        advisor:advisors (id, name, elevenlabs_voice_id)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
    }

    // Update status to generating
    await supabase
      .from('videos')
      .update({ generation_status: 'generating' })
      .eq('id', videoId);

    // Get voice ID from advisor or use provided one
    const selectedVoiceId = voiceId || video.advisor?.elevenlabs_voice_id || '1bd001e7e50f421d891986aad5158bc8';
    
    // Calculate dimensions based on aspect ratio (default to 9:16 for short videos)
    const selectedAspectRatio = aspectRatio || '9:16';
    const dimensions = selectedAspectRatio === '16:9' 
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };

    console.log(`Creating video with aspect ratio ${selectedAspectRatio}, voice: ${selectedVoiceId}`);

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
              type: 'talking_photo',
              talking_photo_id: photoAssetId,
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: selectedVoiceId,
            },
          }
        ],
        dimension: dimensions,
        aspect_ratio: selectedAspectRatio,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen API error:', errorText);
      
      await supabase
        .from('videos')
        .update({ generation_status: 'error' })
        .eq('id', videoId);
      
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const heygenVideoId = result.data?.video_id;

    if (!heygenVideoId) {
      throw new Error('No video ID returned from HeyGen');
    }

    console.log('HeyGen video created:', heygenVideoId);

    // Update video with HeyGen ID
    await supabase
      .from('videos')
      .update({ 
        heygen_video_id: heygenVideoId,
        generation_status: 'generating',
      })
      .eq('id', videoId);

    const durationMs = Date.now() - startTime;

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'heygen_video_started',
      entity_type: 'video',
      entity_id: videoId,
      details: { heygen_video_id: heygenVideoId, photo_asset_id: photoAssetId },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ success: true, heygenVideoId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('HeyGen error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
