import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MotionRequest {
  sceneId?: string;
  advisorId?: string;
  videoId?: string;
  motionType?: string;
  motionPrompt?: string;
}

async function validateMotionId(motionAvatarId: string, heygenKey: string): Promise<boolean> {
  try {
    console.log('Validating existing motion_avatar_id:', motionAvatarId);
    const res = await fetch('https://api.heygen.com/v1/talking_photo.list', {
      headers: { 'X-Api-Key': heygenKey },
    });
    if (!res.ok) {
      console.warn('talking_photo.list failed:', res.status);
      return false;
    }
    const data = await res.json();
    const photos = data?.data?.talking_photos || [];
    const found = photos.find((p: any) => p.talking_photo_id === motionAvatarId);
    if (found) {
      console.log('Motion avatar found in HeyGen, valid ✓');
      return true;
    }
    console.log('Motion avatar NOT found in HeyGen list — invalid');
    return false;
  } catch (e) {
    console.warn('Validation error:', e);
    return false;
  }
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

async function resolveImageUrl(supabase: any, sceneId?: string, advisorId?: string): Promise<{ imageUrl: string; source: string }> {
  // 1. From scene
  if (sceneId) {
    const { data: scene } = await supabase
      .from('playlist_scenes')
      .select(`*, advisor:advisors (id, name, scene_photo_id)`)
      .eq('id', sceneId)
      .single();
    
    if (scene?.scene_url) {
      return { imageUrl: scene.scene_url, source: 'scene' };
    }
    
    // Use scene's advisor for photo fallback
    const effectiveAdvisorId = scene?.advisor_id || advisorId;
    if (effectiveAdvisorId) {
      const result = await resolveAdvisorPhoto(supabase, effectiveAdvisorId, scene?.advisor?.scene_photo_id);
      if (result) return result;
    }
  }

  // 2. From advisor directly (no scene)
  if (advisorId) {
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, name, scene_photo_id')
      .eq('id', advisorId)
      .single();
    
    if (advisor) {
      const result = await resolveAdvisorPhoto(supabase, advisorId, advisor.scene_photo_id);
      if (result) return result;
    }
  }

  throw new Error('No image found for motion avatar — no scene_url and no advisor photos');
}

async function resolveAdvisorPhoto(supabase: any, advisorId: string, scenePhotoId?: string | null): Promise<{ imageUrl: string; source: string } | null> {
  // scene_photo_id first
  if (scenePhotoId) {
    const { data: scenePhoto } = await supabase
      .from('advisor_photos')
      .select('photo_url')
      .eq('id', scenePhotoId)
      .single();
    if (scenePhoto?.photo_url) {
      return { imageUrl: scenePhoto.photo_url, source: 'advisor_scene_photo' };
    }
  }
  
  // primary photo fallback
  const { data: photos } = await supabase
    .from('advisor_photos')
    .select('photo_url, is_primary')
    .eq('advisor_id', advisorId)
    .not('photo_url', 'is', null)
    .order('is_primary', { ascending: false })
    .limit(1);
  
  if (photos?.[0]?.photo_url) {
    return { imageUrl: photos[0].photo_url, source: 'advisor_primary_photo' };
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { sceneId, advisorId, videoId, motionType, motionPrompt } = await req.json() as MotionRequest;

    if (!sceneId && !advisorId) {
      throw new Error('Either sceneId or advisorId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===== REUSE CHECK: Check scene, then video for existing motion_avatar_id =====
    let existingMotionId: string | null = null;
    
    if (sceneId) {
      const { data: scene } = await supabase
        .from('playlist_scenes')
        .select('motion_avatar_id')
        .eq('id', sceneId)
        .single();
      existingMotionId = scene?.motion_avatar_id || null;
    }
    
    if (!existingMotionId && videoId) {
      const { data: video } = await supabase
        .from('videos')
        .select('motion_avatar_id')
        .eq('id', videoId)
        .single();
      existingMotionId = video?.motion_avatar_id || null;
    }

    if (existingMotionId) {
      console.log('Found existing motion_avatar_id:', existingMotionId, '— validating...');
      const isValid = await validateMotionId(existingMotionId, heygenKey);
      if (isValid) {
        console.log('Existing motion avatar is valid — reusing');
        const durationMs = Date.now() - startTime;
        await supabase.from('activity_log').insert({
          action: 'motion_reused',
          entity_type: sceneId ? 'scene' : 'video',
          entity_id: sceneId || videoId,
          details: { motion_avatar_id: existingMotionId, status: 'reused' },
          duration_ms: durationMs,
        });
        // Sync to both scene and video if possible
        if (sceneId) {
          await supabase.from('playlist_scenes').update({ motion_avatar_id: existingMotionId }).eq('id', sceneId);
        }
        if (videoId) {
          await supabase.from('videos').update({ motion_avatar_id: existingMotionId }).eq('id', videoId);
        }
        return new Response(
          JSON.stringify({ success: true, motionAvatarId: existingMotionId, reused: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Invalid — clear and create fresh
      console.log('Existing motion_avatar_id is invalid — clearing and creating new');
      if (sceneId) {
        await supabase.from('playlist_scenes').update({ motion_avatar_id: null }).eq('id', sceneId);
      }
      if (videoId) {
        await supabase.from('videos').update({ motion_avatar_id: null }).eq('id', videoId);
      }
    }

    // ===== Resolve image URL via fallback chain =====
    const { imageUrl, source: imageSource } = await resolveImageUrl(supabase, sceneId, advisorId);
    console.log('Image resolved from:', imageSource, '→', imageUrl.substring(0, 80));

    // Upload as talking_photo
    const talkingPhotoId = await uploadTalkingPhoto(imageUrl, heygenKey);
    console.log('talking_photo_id for motion:', talkingPhotoId);

    // Call add_motion API (unified endpoint)
    const MAX_PROMPT_LENGTH = 512;
    const rawPrompt = motionPrompt || 'The person gestures naturally with their hands while explaining something';
    const truncatedPrompt = rawPrompt.length > MAX_PROMPT_LENGTH ? rawPrompt.slice(0, MAX_PROMPT_LENGTH) : rawPrompt;

    const motionBody = {
      id: talkingPhotoId,
      prompt: truncatedPrompt,
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

    const motionAvatarId = motionResult.data?.talking_photo_id 
      || motionResult.data?.avatar_id 
      || motionResult.data?.id;

    if (!motionAvatarId) throw new Error('No motion avatar ID returned: ' + JSON.stringify(motionResult));

    // Save to scene AND video
    if (sceneId) {
      await supabase.from('playlist_scenes').update({
        motion_avatar_id: motionAvatarId,
        motion_type: motionType || 'consistent',
        motion_prompt: motionPrompt || motionBody.prompt,
      }).eq('id', sceneId);
    }
    if (videoId) {
      await supabase.from('videos').update({
        motion_avatar_id: motionAvatarId,
        motion_type: motionType || 'consistent',
        motion_prompt: motionPrompt || motionBody.prompt,
      }).eq('id', videoId);
    }

    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'add_avatar_motion',
      entity_type: sceneId ? 'scene' : 'video',
      entity_id: sceneId || videoId,
      details: { motion_type: motionType, motion_avatar_id: motionAvatarId, image_source: imageSource },
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
