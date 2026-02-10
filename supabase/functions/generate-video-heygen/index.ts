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

  return await response.arrayBuffer();
}

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

    // Get video with advisor info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        advisor:advisors (id, name, display_name, elevenlabs_voice_id)
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

    // Determine the script text
    const scriptText = script || video.advisor_answer;
    if (!scriptText) {
      throw new Error('No script/answer text available for video generation');
    }

    // Determine talking photo ID - use provided or find from advisor photos
    let talkingPhotoId = photoAssetId;
    if (!talkingPhotoId && video.advisor_id) {
      const { data: photos } = await supabase
        .from('advisor_photos')
        .select('heygen_asset_id')
        .eq('advisor_id', video.advisor_id)
        .eq('is_primary', true)
        .limit(1);
      
      talkingPhotoId = photos?.[0]?.heygen_asset_id || null;
      
      if (!talkingPhotoId) {
        // Fallback: get any photo with heygen_asset_id
        const { data: anyPhotos } = await supabase
          .from('advisor_photos')
          .select('heygen_asset_id')
          .eq('advisor_id', video.advisor_id)
          .not('heygen_asset_id', 'is', null)
          .limit(1);
        
        talkingPhotoId = anyPhotos?.[0]?.heygen_asset_id || null;
      }
    }

    if (!talkingPhotoId) {
      throw new Error('No HeyGen photo asset found. Upload a photo to HeyGen first.');
    }

    // Step 1: Generate voiceover via ElevenLabs or use provided audio URL
    let voiceoverUrl = audioUrl || video.voiceover_url;
    
    if (!voiceoverUrl) {
      // Generate voiceover with ElevenLabs
      const selectedVoiceId = voiceId || video.advisor?.elevenlabs_voice_id || 'B7vhQtHJ3xG23dClyJE4';
      
      const audioBuffer = await generateVoiceover(scriptText, selectedVoiceId, elevenLabsKey);
      
      // Upload to storage
      const fileName = `voiceovers/${videoId}_${Date.now()}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) {
        throw new Error(`Failed to upload voiceover: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);
      voiceoverUrl = urlData.publicUrl;

      // Save voiceover URL to video
      await supabase
        .from('videos')
        .update({ voiceover_url: voiceoverUrl })
        .eq('id', videoId);

      console.log('Voiceover generated and uploaded:', voiceoverUrl);
    }

    // Step 2: Send to HeyGen with audio URL
    const selectedAspectRatio = aspectRatio || '9:16';
    const dimensions = selectedAspectRatio === '16:9' 
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };

    console.log(`Creating HeyGen video with aspect ratio ${selectedAspectRatio}, audio: ${voiceoverUrl}`);

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
              talking_photo_id: talkingPhotoId,
            },
            voice: {
              type: 'audio',
              audio_url: voiceoverUrl,
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
      details: { heygen_video_id: heygenVideoId, photo_asset_id: talkingPhotoId },
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
