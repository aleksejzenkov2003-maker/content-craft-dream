import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  videoId: string;
  photoAssetId?: string;
  script?: string;
  voiceId?: string;
  audioUrl?: string;
  aspectRatio?: '16:9' | '9:16';
}

async function generateVoiceover(text: string, voiceId: string, elevenLabsKey: string): Promise<ArrayBuffer> {
  console.log(`Generating voiceover with ElevenLabs, voice: ${voiceId}`);
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
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true }
      })
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }
  return await response.arrayBuffer();
}

async function uploadTalkingPhoto(imageUrl: string, heygenKey: string): Promise<string> {
  console.log('Downloading image for HeyGen talking_photo upload...');
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  // Upload via /v1/talking_photo endpoint (required for v2/video/generate)
  console.log('Uploading to HeyGen as talking_photo...');
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
  console.log('HeyGen talking_photo upload response:', JSON.stringify(uploadData));
  const talkingPhotoId = uploadData.data?.talking_photo_id || uploadData.data?.id;
  if (!talkingPhotoId) throw new Error('No talking_photo_id returned: ' + JSON.stringify(uploadData));
  
  console.log('HeyGen talking_photo uploaded, id:', talkingPhotoId);
  return talkingPhotoId;
}

// uploadAudioToHeygen removed — v2 API accepts audio_url directly

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { videoId, photoAssetId, script, voiceId, audioUrl, aspectRatio } = await req.json() as GenerateRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating HeyGen video for video ${videoId}`);

    // Get video with advisor and playlist info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        advisor:advisors (id, name, display_name, elevenlabs_voice_id, scene_photo_id, avatar_photo_id)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    await supabase.from('videos').update({ generation_status: 'generating' }).eq('id', videoId);

    const scriptText = script || video.advisor_answer;
    if (!scriptText) throw new Error('No script/answer text available for video generation');

    // =============================================
    // Try to find an approved scene for this video
    // =============================================
    let sceneUrl: string | null = null;
    let sceneMotionAvatarId: string | null = null;
    let sceneMotionType: string | null = null;
    let sceneMotionPrompt: string | null = null;
    let sceneId: string | null = null;
    if (video.playlist_id && video.advisor_id) {
      const { data: scenes } = await supabase
        .from('playlist_scenes')
        .select('id, scene_url, motion_avatar_id, motion_type, motion_prompt')
        .eq('playlist_id', video.playlist_id)
        .eq('advisor_id', video.advisor_id)
        .eq('status', 'approved')
        .not('scene_url', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      sceneId = scenes?.[0]?.id || null;
      sceneUrl = scenes?.[0]?.scene_url || null;
      sceneMotionAvatarId = scenes?.[0]?.motion_avatar_id || null;
      sceneMotionType = scenes?.[0]?.motion_type || null;
      sceneMotionPrompt = scenes?.[0]?.motion_prompt || null;
      console.log('Scene lookup:', { found: !!sceneUrl, sceneId, motionAvatarId: sceneMotionAvatarId || 'none' });
      
      // Sync stale video motion_avatar_id with scene's
      if (sceneMotionAvatarId && video.motion_avatar_id !== sceneMotionAvatarId) {
        await supabase.from('videos').update({ 
          motion_avatar_id: sceneMotionAvatarId,
          motion_type: sceneMotionType,
        }).eq('id', videoId);
        console.log('Synced video motion_avatar_id from scene:', sceneMotionAvatarId);
      }
    }

    // =============================================
    // Step 1: Prepare voiceover
    // =============================================
    let voiceoverUrl = audioUrl || video.voiceover_url;
    
    if (!voiceoverUrl) {
      const selectedVoiceId = voiceId || video.advisor?.elevenlabs_voice_id || 'B7vhQtHJ3xG23dClyJE4';
      const audioBuffer = await generateVoiceover(scriptText, selectedVoiceId, elevenLabsKey);
      
      const fileName = `voiceovers/${videoId}_${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) throw new Error(`Failed to upload voiceover: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
      voiceoverUrl = urlData.publicUrl;

      await supabase.from('videos').update({ voiceover_url: voiceoverUrl }).eq('id', videoId);
      console.log('Voiceover generated:', voiceoverUrl);
    }

    // =============================================
    // Step 2: Generate video via HeyGen (Avatar III — v2/video/generate)
    // =============================================
    const dimension = aspectRatio === '16:9' 
      ? { width: 1920, height: 1080 } 
      : { width: 1080, height: 1920 };

    // --- Resolve image for talking_photo ---
    // In overlay mode, prefer avatar_photo_id (transparent/no-background photo)
    let imageUrl: string | null = null;
    let backgroundVideoUrl: string | null = null;

    // Read video_format_mode early to decide image selection
    const { data: fmtRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'video_format_mode');
    const isOverlayModePre = (fmtRows?.[0] as any)?.value === 'background_overlay';

    if (isOverlayModePre && video.advisor_id && video.advisor?.avatar_photo_id) {
      // Use transparent avatar photo for overlay mode
      const { data: avatarPhoto } = await supabase
        .from('advisor_photos')
        .select('photo_url')
        .eq('id', video.advisor.avatar_photo_id)
        .single();
      imageUrl = avatarPhoto?.photo_url || null;
      if (imageUrl) console.log('OVERLAY MODE: Using avatar_photo_id (transparent)');

      // Find background video for this playlist+advisor combo via assignments table
      if (video.playlist_id) {
        const { data: bgAssignments } = await supabase
          .from('background_assignments')
          .select('background:background_videos(media_url, media_type)')
          .eq('playlist_id', video.playlist_id)
          .eq('advisor_id', video.advisor_id)
          .limit(1);
        backgroundVideoUrl = (bgAssignments as any)?.[0]?.background?.media_url || null;
        console.log('Background video:', backgroundVideoUrl ? 'found' : 'not found');
      }
    }

    // Standard image resolution (if not already set by overlay mode)
    if (!imageUrl) {
      imageUrl = sceneUrl;
    }

    if (!imageUrl) {
      // Fallback: advisor photo → cover
      if (video.advisor_id) {
        if (video.advisor?.scene_photo_id) {
          const { data: scenePhoto } = await supabase
            .from('advisor_photos')
            .select('photo_url')
            .eq('id', video.advisor.scene_photo_id)
            .single();
          imageUrl = scenePhoto?.photo_url || null;
          console.log('Using scene_photo_id photo:', imageUrl ? 'found' : 'not found');
        }

        if (!imageUrl) {
          const { data: photos } = await supabase
            .from('advisor_photos')
            .select('photo_url, is_primary, created_at')
            .eq('advisor_id', video.advisor_id)
            .not('photo_url', 'is', null)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1);

          imageUrl = photos?.[0]?.photo_url || null;
          if (imageUrl) console.log('Using advisor photo');
        }
      }

      if (!imageUrl) {
        imageUrl = video.front_cover_url || video.atmosphere_url || null;
        if (imageUrl) console.log('WARNING: Using cover/atmosphere as fallback — may lack face');
      }
    }

    if (!imageUrl) {
      throw new Error('No image found. Upload advisor photo or generate a cover first.');
    }

    // --- Determine HeyGen mode and motion setting ---
    let motionWarning: string | null = null;
    
    const { data: settingsRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['heygen_mode', 'motion_enabled', 'video_format_mode']);
    
    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value; });
    
    const heygenMode = settingsMap['heygen_mode'] || 'v3';
    const motionEnabled = settingsMap['motion_enabled'] !== 'false'; // default true
    const videoFormatMode = settingsMap['video_format_mode'] || 'full_photo';
    const isOverlayMode = videoFormatMode === 'background_overlay';
    const heygenEndpoint = heygenMode === 'v4'
      ? 'https://api.heygen.com/v2/video/av4/generate'
      : 'https://api.heygen.com/v2/video/generate';
    console.log(`Using HeyGen mode: ${heygenMode}, motion_enabled: ${motionEnabled}, video_format: ${videoFormatMode}, endpoint: ${heygenEndpoint}`);

    // Use scene's motion_avatar_id first, then video's (backward compat), otherwise upload fresh
    let talkingPhotoIdFinal: string;
    let effectiveMotionAvatarId = motionEnabled 
      ? (sceneMotionAvatarId || (sceneUrl ? null : video.motion_avatar_id)) 
      : null;

    // Last-resort: if motion is enabled but no motion_avatar_id exists, try to create one now
    if (motionEnabled && !effectiveMotionAvatarId && sceneId && heygenMode === 'v3') {
      console.log('Motion enabled but no motion_avatar_id — attempting last-resort creation...');
      try {
        // Upload talking photo first
        const tempTalkingPhotoId = await uploadTalkingPhoto(imageUrl, heygenKey);
        
        // Call HeyGen add_motion API
        const motionPrompt = sceneMotionPrompt || video.motion_prompt || 'The person gestures naturally with their hands while explaining something';
        const addMotionRes = await fetch('https://api.heygen.com/v1/talking_photo.add_motion', {
          method: 'POST',
          headers: { 'X-Api-Key': heygenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: tempTalkingPhotoId, prompt: motionPrompt }),
        });
        
        if (addMotionRes.ok) {
          const motionData = await addMotionRes.json();
          const newMotionId = motionData?.data?.talking_photo_id;
          if (newMotionId) {
            effectiveMotionAvatarId = newMotionId;
            // Save for future reuse
            await supabase.from('playlist_scenes').update({ motion_avatar_id: newMotionId }).eq('id', sceneId);
            await supabase.from('videos').update({ motion_avatar_id: newMotionId }).eq('id', videoId);
            console.log('Last-resort motion created:', newMotionId);
            try {
              await supabase.from('activity_log').insert({
                action: 'last_resort_motion_created',
                entity_type: 'video',
                entity_id: videoId,
                details: { motion_avatar_id: newMotionId, scene_id: sceneId },
              });
            } catch (_) { /* ignore */ }
          }
        } else {
          const errText = await addMotionRes.text();
          console.warn('Last-resort motion creation failed:', errText);
          motionWarning = `Motion не применён: ошибка создания (${addMotionRes.status})`;
        }
      } catch (motionErr) {
        console.warn('Last-resort motion error:', motionErr);
        motionWarning = 'Motion не применён: ошибка при создании';
      }
    }

    if (effectiveMotionAvatarId && heygenMode === 'v3') {
      talkingPhotoIdFinal = effectiveMotionAvatarId;
      console.log('Using motion_avatar_id:', talkingPhotoIdFinal, 'source:', sceneMotionAvatarId ? 'scene' : 'last-resort/video');
    } else {
      talkingPhotoIdFinal = await uploadTalkingPhoto(imageUrl, heygenKey);
      console.log('talking_photo_id (fresh upload, no motion):', talkingPhotoIdFinal);
      if (motionEnabled && heygenMode === 'v3' && !motionWarning) {
        motionWarning = 'Motion не применён: motion_avatar_id отсутствует';
      }
    }

    // --- Call HeyGen API ---
    const buildHeygenBody = (photoId: string, useExpressive: boolean) => JSON.stringify({
      title: video.video_title || video.question || `Video ${videoId}`,
      video_inputs: [{
        character: {
          type: 'talking_photo',
          talking_photo_id: photoId,
          ...(useExpressive ? { talking_style: 'expressive' } : {}),
        },
        voice: {
          type: 'audio',
          audio_url: voiceoverUrl,
        },
      }],
      dimension,
    });

    const useMotion = !!effectiveMotionAvatarId && heygenMode === 'v3';
    let heygenResponse: Response;

    if (useMotion) {
      // Single attempt with motion avatar — if not ready, fall back immediately
      console.log('Attempting motion avatar:', talkingPhotoIdFinal);
      heygenResponse = await fetch(heygenEndpoint, {
        method: 'POST',
        headers: { 'X-Api-Key': heygenKey, 'Content-Type': 'application/json' },
        body: buildHeygenBody(talkingPhotoIdFinal, true),
      });

      if (!heygenResponse.ok) {
        const errorText = await heygenResponse.text();
        if (errorText.includes('missing image dimensions')) {
          // Motion not ready yet — fall back to static, preserve motion_avatar_id for next run
          motionWarning = 'Motion не применён: аватар ещё обрабатывается, используется статичное фото (motion сохранён для следующего ролика)';
          console.warn('Motion not ready — graceful fallback to static photo. ID preserved in DB.');
          try {
            await supabase.from('activity_log').insert({
              action: 'motion_fallback_to_static',
              entity_type: 'video',
              entity_id: videoId,
              details: { motion_avatar_id: talkingPhotoIdFinal, reason: 'not_ready_single_attempt' },
            });
          } catch (_) { /* ignore */ }

          talkingPhotoIdFinal = await uploadTalkingPhoto(imageUrl!, heygenKey);
          console.log('Fallback static talking_photo_id:', talkingPhotoIdFinal);
          heygenResponse = await fetch(heygenEndpoint, {
            method: 'POST',
            headers: { 'X-Api-Key': heygenKey, 'Content-Type': 'application/json' },
            body: buildHeygenBody(talkingPhotoIdFinal, false),
          });
        }
        // else: non-motion error, will be caught below
      } else {
        console.log('Motion avatar applied successfully!');
      }
    } else {
      // No motion — single call
      heygenResponse = await fetch(heygenEndpoint, {
        method: 'POST',
        headers: { 'X-Api-Key': heygenKey, 'Content-Type': 'application/json' },
        body: buildHeygenBody(talkingPhotoIdFinal, false),
      });
    }

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error('HeyGen v2 API error:', errorText);
      await supabase.from('videos').update({ generation_status: 'error' }).eq('id', videoId);
      throw new Error(`HeyGen v2 API error: ${heygenResponse.status} - ${errorText}`);
    }

    const heygenResult = await heygenResponse.json();
    const heygenVideoId = heygenResult.data?.video_id;
    if (!heygenVideoId) throw new Error('No video ID from HeyGen v2: ' + JSON.stringify(heygenResult));

    console.log('HeyGen video created:', heygenVideoId);

    await supabase.from('videos').update({ 
      heygen_video_id: heygenVideoId,
      generation_status: 'generating',
    }).eq('id', videoId);

    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'heygen_video_started',
      entity_type: 'video',
      entity_id: videoId,
      details: { heygen_video_id: heygenVideoId, used_scene: !!sceneUrl, motion_used: !!effectiveMotionAvatarId, motion_avatar_id: effectiveMotionAvatarId || null, motion_warning: motionWarning || null, overlay_mode: isOverlayModePre, background_video_url: backgroundVideoUrl },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ success: true, heygenVideoId, usedScene: !!sceneUrl, motionWarning, overlayMode: isOverlayModePre, backgroundVideoUrl }),
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
