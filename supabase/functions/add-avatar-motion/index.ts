import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MotionRequest {
  videoId: string;
  motionType?: string;
  motionPrompt?: string;
}

async function uploadTalkingPhoto(imageUrl: string, heygenKey: string): Promise<string> {
  console.log('Downloading image for talking_photo upload...');
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  const uploadRes = await fetch('https://upload.heygen.com/v1/talking_photo', {
    method: 'POST',
    headers: {
      'X-Api-Key': heygenKey,
      'Content-Type': imgBlob.type || 'image/png',
    },
    body: imgBlob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`HeyGen talking_photo upload failed: ${uploadRes.status} - ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const talkingPhotoId = uploadData.data?.talking_photo_id || uploadData.data?.id;
  if (!talkingPhotoId) throw new Error('No talking_photo_id returned: ' + JSON.stringify(uploadData));
  return talkingPhotoId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { videoId, motionType, motionPrompt } = await req.json() as MotionRequest;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video with advisor info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`*, advisor:advisors (id, name, scene_photo_id)`)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    // Resolve image URL (same logic as generate-video-heygen)
    let imageUrl: string | null = null;

    // Try playlist scene first
    if (video.playlist_id && video.advisor_id) {
      const { data: scenes } = await supabase
        .from('playlist_scenes')
        .select('scene_url')
        .eq('playlist_id', video.playlist_id)
        .eq('advisor_id', video.advisor_id)
        .eq('review_status', 'approved')
        .not('scene_url', 'is', null)
        .limit(1);
      imageUrl = scenes?.[0]?.scene_url || null;
    }

    if (!imageUrl && video.advisor_id) {
      if (video.advisor?.scene_photo_id) {
        const { data: scenePhoto } = await supabase
          .from('advisor_photos')
          .select('photo_url')
          .eq('id', video.advisor.scene_photo_id)
          .single();
        imageUrl = scenePhoto?.photo_url || null;
      }
      if (!imageUrl) {
        const { data: photos } = await supabase
          .from('advisor_photos')
          .select('photo_url, is_primary')
          .eq('advisor_id', video.advisor_id)
          .not('photo_url', 'is', null)
          .order('is_primary', { ascending: false })
          .limit(1);
        imageUrl = photos?.[0]?.photo_url || null;
      }
    }

    if (!imageUrl) {
      imageUrl = video.front_cover_url || video.atmosphere_url || null;
    }

    if (!imageUrl) throw new Error('No image found for motion avatar');

    // Upload as talking_photo
    const talkingPhotoId = await uploadTalkingPhoto(imageUrl, heygenKey);
    console.log('talking_photo_id for motion:', talkingPhotoId);

    // Call add_motion API
    const motionBody = {
      id: talkingPhotoId,
      prompt: motionPrompt || 'The person gestures naturally with their hands while explaining something',
      motion_type: motionType || 'consistent',
    };

    console.log('Calling add_motion:', JSON.stringify(motionBody));

    const motionRes = await fetch('https://api.heygen.com/v2/photo_avatar/add_motion', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(motionBody),
    });

    if (!motionRes.ok) {
      const errText = await motionRes.text();
      throw new Error(`HeyGen add_motion failed: ${motionRes.status} - ${errText}`);
    }

    const motionResult = await motionRes.json();
    console.log('add_motion response:', JSON.stringify(motionResult));

    // Extract the new motion avatar ID
    const motionAvatarId = motionResult.data?.talking_photo_id 
      || motionResult.data?.avatar_id 
      || motionResult.data?.id;

    if (!motionAvatarId) throw new Error('No motion avatar ID returned: ' + JSON.stringify(motionResult));

    // Save to video
    await supabase.from('videos').update({
      motion_avatar_id: motionAvatarId,
      motion_type: motionType || 'consistent',
      motion_prompt: motionPrompt || motionBody.prompt,
    }).eq('id', videoId);

    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'add_avatar_motion',
      entity_type: 'video',
      entity_id: videoId,
      details: { motion_type: motionType, motion_avatar_id: motionAvatarId },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ success: true, motionAvatarId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Add motion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
