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

async function uploadAssetToHeygen(imageUrl: string, heygenKey: string): Promise<string> {
  console.log('Downloading scene image for HeyGen upload...');
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download scene image: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  // Upload as raw binary (matching n8n workflow contentType: "binaryData")
  console.log('Uploading scene to HeyGen assets (raw binary)...');
  const uploadRes = await fetch('https://upload.heygen.com/v1/asset', {
    method: 'POST',
    headers: {
      'X-Api-Key': heygenKey,
      'Content-Type': imgBlob.type || 'image/png',
    },
    body: imgBlob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`HeyGen asset upload failed: ${uploadRes.status} - ${errText}`);
  }

  const uploadData = await uploadRes.json();
  console.log('HeyGen upload response:', JSON.stringify(uploadData));
  const imageKey = uploadData.data?.image_key || uploadData.data?.asset_id || uploadData.data?.id;
  if (!imageKey) throw new Error('No image_key returned from HeyGen: ' + JSON.stringify(uploadData));
  
  console.log('HeyGen asset uploaded, image_key:', imageKey);
  return imageKey;
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
        advisor:advisors (id, name, display_name, elevenlabs_voice_id, scene_photo_id)
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
    if (video.playlist_id && video.advisor_id) {
      const { data: scenes } = await supabase
        .from('playlist_scenes')
        .select('scene_url')
        .eq('playlist_id', video.playlist_id)
        .eq('advisor_id', video.advisor_id)
        .eq('review_status', 'approved')
        .not('scene_url', 'is', null)
        .limit(1);
      
      sceneUrl = scenes?.[0]?.scene_url || null;
      console.log('Scene found:', sceneUrl ? 'YES' : 'NO');
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
    // Step 2: Generate video via HeyGen
    // =============================================
    const selectedOrientation = aspectRatio === '16:9' ? 'landscape' : 'portrait';

    let heygenVideoId: string;

    if (sceneUrl) {
      // === Scene-based generation via av4 API ===
      console.log('Using scene-based generation (av4 API)...');
      
      const imageKey = await uploadAssetToHeygen(sceneUrl, heygenKey);
      const audioAssetId = await uploadAudioToHeygen(voiceoverUrl, heygenKey);

      const av4Response = await fetch('https://api.heygen.com/v2/video/av4/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': heygenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_title: video.video_title || video.question || `Video ${videoId}`,
          video_orientation: selectedOrientation,
          fit: 'cover',
          image_key: imageKey,
          audio_asset_id: audioAssetId,
          custom_motion_prompt: 'calm spiritual mentor, light hand movement, soft breathing, subtle head motion, natural eye contact, steady posture, gentle facial expressions, slow rhythm',
          enhance_custom_motion_prompt: true,
        }),
      });

      if (!av4Response.ok) {
        const errorText = await av4Response.text();
        console.error('HeyGen av4 API error:', errorText);
        await supabase.from('videos').update({ generation_status: 'error' }).eq('id', videoId);
        throw new Error(`HeyGen av4 API error: ${av4Response.status} - ${errorText}`);
      }

      const av4Result = await av4Response.json();
      heygenVideoId = av4Result.data?.video_id;
      if (!heygenVideoId) throw new Error('No video ID from HeyGen av4: ' + JSON.stringify(av4Result));

    } else {
      // === FALLBACK: Use advisor photo (with face) as primary, covers as last resort ===
      console.log('Using fallback image for av4 API...');

      // HeyGen av4 requires an image WITH A FACE.
      // Priority: advisor scene_photo > advisor primary photo > front_cover_url > atmosphere_url
      let fallbackImageUrl: string | null = null;
      let fallbackImageKey: string | null = null;

      if (video.advisor_id) {
        // 1. Try scene_photo_id from advisor settings (portrait with face)
        if (video.advisor?.scene_photo_id) {
          const { data: scenePhoto } = await supabase
            .from('advisor_photos')
            .select('photo_url, heygen_asset_id')
            .eq('id', video.advisor.scene_photo_id)
            .single();
          fallbackImageUrl = scenePhoto?.photo_url || null;
          fallbackImageKey = scenePhoto?.heygen_asset_id || null;
          console.log('Using scene_photo_id photo:', fallbackImageUrl ? 'found' : 'not found');
          if (fallbackImageKey) console.log('scene_photo_id has existing heygen image_key');
        }

        // 2. Fallback to advisor photos (prefer already uploaded heygen_asset_id)
        if (!fallbackImageUrl) {
          const { data: photos } = await supabase
            .from('advisor_photos')
            .select('photo_url, is_primary, heygen_asset_id, created_at')
            .eq('advisor_id', video.advisor_id)
            .not('photo_url', 'is', null)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(10);

          const photoWithAsset = photos?.find((p: { heygen_asset_id: string | null }) => !!p.heygen_asset_id);
          if (photoWithAsset) {
            fallbackImageUrl = photoWithAsset.photo_url;
            fallbackImageKey = photoWithAsset.heygen_asset_id;
            console.log('Using advisor photo with existing heygen image_key');
          } else {
            fallbackImageUrl = photos?.find((p: { is_primary: boolean | null }) => p.is_primary)?.photo_url
              || photos?.[0]?.photo_url
              || null;
            if (fallbackImageUrl) console.log('Using advisor photo (primary/first)');
          }
        }
      }

      // 3. Last resort: cover images (may not contain a face — HeyGen may reject)
      if (!fallbackImageUrl) {
        fallbackImageUrl = video.front_cover_url || video.atmosphere_url || null;
        if (fallbackImageUrl) console.log('WARNING: Using cover/atmosphere as fallback — may lack face');
      }

      if (!fallbackImageUrl && !fallbackImageKey) {
        throw new Error('No image found. Upload advisor photo or generate a cover first.');
      }

      if (fallbackImageUrl) {
        console.log('Using fallback image:', fallbackImageUrl.substring(0, 80) + '...');
      }

      const imageKey = fallbackImageKey || await uploadAssetToHeygen(fallbackImageUrl!, heygenKey);
      const audioAssetId = await uploadAudioToHeygen(voiceoverUrl, heygenKey);

      const av4Response = await fetch('https://api.heygen.com/v2/video/av4/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': heygenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_title: video.video_title || video.question || `Video ${videoId}`,
          video_orientation: selectedOrientation,
          fit: 'cover',
          image_key: imageKey,
          audio_asset_id: audioAssetId,
          custom_motion_prompt: 'calm spiritual mentor, light hand movement, soft breathing, subtle head motion, natural eye contact, steady posture, gentle facial expressions, slow rhythm',
          enhance_custom_motion_prompt: true,
        }),
      });

      if (!av4Response.ok) {
        const errorText = await av4Response.text();
        console.error('HeyGen av4 API error (fallback):', errorText);
        await supabase.from('videos').update({ generation_status: 'error' }).eq('id', videoId);
        throw new Error(`HeyGen av4 API error: ${av4Response.status} - ${errorText}`);
      }

      const av4Result = await av4Response.json();
      heygenVideoId = av4Result.data?.video_id;
      if (!heygenVideoId) throw new Error('No video ID from HeyGen av4 fallback: ' + JSON.stringify(av4Result));
    }

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
      details: { heygen_video_id: heygenVideoId, used_scene: !!sceneUrl },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ success: true, heygenVideoId, usedScene: !!sceneUrl }),
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
