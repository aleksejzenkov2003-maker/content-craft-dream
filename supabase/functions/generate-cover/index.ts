import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function pollTaskStatus(taskId: string, apiKey: string, maxAttempts = 60, intervalMs = 3000): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Query task failed: ${res.status} - ${errText}`);
    }

    const result = await res.json();
    console.log(`Poll attempt ${i + 1}, state:`, result.data?.state, 'status:', result.data?.status);

    if (result.data?.state === 'success' || result.data?.status === 'SUCCESS' || result.data?.status === 'completed') {
      if (result.data?.resultJson) {
        try {
          const parsed = typeof result.data.resultJson === 'string' 
            ? JSON.parse(result.data.resultJson) 
            : result.data.resultJson;
          if (parsed.resultUrls && parsed.resultUrls.length > 0) {
            return parsed.resultUrls[0];
          }
        } catch (e) {
          console.log('Failed to parse resultJson:', e);
        }
      }
      
      const imageUrl = result.data?.output?.imageUrl || result.data?.output?.image_url || result.data?.response?.imageUrl;
      if (imageUrl) return imageUrl;

      const output = result.data?.output || result.data?.response;
      if (output) {
        const urls = Object.values(output).filter((v): v is string => typeof v === 'string' && v.startsWith('http'));
        if (urls.length > 0) return urls[0];
      }
      throw new Error('Task completed but no image URL found: ' + JSON.stringify(result.data));
    }

    if (result.data?.state === 'fail' || result.data?.status === 'FAILED' || result.data?.status === 'failed') {
      throw new Error('Task failed: ' + (result.data?.failMsg || JSON.stringify(result.data)));
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Task polling timeout');
}

async function downloadAndUpload(
  imageUrl: string, 
  supabase: any, 
  path: string
): Promise<string> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);
  const imageBuffer = new Uint8Array(await imageRes.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('media-files')
    .upload(path, imageBuffer, { contentType: 'image/png', upsert: true });

  if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(path);
  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: { videoId?: string; atmospherePrompt?: string; step?: string } | null = null;

  try {
    requestBody = await req.json();
    const { videoId, atmospherePrompt, step } = requestBody;
    if (!videoId) throw new Error('Video ID is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiKey = Deno.env.get('KIE_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!kieApiKey) throw new Error('KIE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch video + advisor + playlist + primary photo
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        advisor:advisors (id, name, display_name),
        playlist:playlists (id, name)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    // Get advisor primary photo
    let advisorPhotoUrl: string | null = null;
    if (video.advisor_id) {
      const { data: photos } = await supabase
        .from('advisor_photos')
        .select('photo_url')
        .eq('advisor_id', video.advisor_id)
        .eq('is_primary', true)
        .limit(1);
      
      advisorPhotoUrl = photos?.[0]?.photo_url || null;

      if (!advisorPhotoUrl) {
        const { data: anyPhotos } = await supabase
          .from('advisor_photos')
          .select('photo_url')
          .eq('advisor_id', video.advisor_id)
          .limit(1);
        advisorPhotoUrl = anyPhotos?.[0]?.photo_url || null;
      }
    }

    // Update status
    await supabase.from('videos').update({ cover_status: 'generating' }).eq('id', videoId);

    // Determine which steps to run
    const runAtmosphere = !step || step === 'atmosphere';
    const runOverlay = !step || step === 'overlay';

    let atmosphereStorageUrl = video.atmosphere_url;
    let finalAtmospherePrompt = video.atmosphere_prompt || '';

    // =============================================
    // STEP 1: Generate atmosphere background
    // =============================================
    if (runAtmosphere) {
      let generatedAtmospherePrompt = atmospherePrompt;

      if (!generatedAtmospherePrompt && lovableApiKey) {
        const advisorName = video.advisor?.display_name || video.advisor?.name || '';
        const playlistName = video.playlist?.name || '';
        
        console.log('Generating atmosphere prompt via AI...');
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a visual concept designer. Generate a short, vivid prompt for an atmospheric background image for a spiritual video cover. 
The image should NOT contain any people or faces - only atmosphere, scenery, and mood.
Output ONLY the image generation prompt, nothing else. Keep it under 100 words.
The prompt should be in English.`
              },
              {
                role: 'user',
                content: `Create an atmosphere background prompt for:
Question: ${video.question || ''}
Hook: ${video.hook || ''}
Answer: ${video.advisor_answer || ''}
Advisor: ${advisorName}
Religion/Topic: ${playlistName}

The background should evoke the spiritual and emotional tone of this content.`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          generatedAtmospherePrompt = aiData.choices?.[0]?.message?.content?.trim() || '';
          console.log('AI generated atmosphere prompt:', generatedAtmospherePrompt);
        }
      }

      if (!generatedAtmospherePrompt) {
        generatedAtmospherePrompt = `Serene spiritual atmosphere, soft ethereal light, contemplative mood, 9:16 portrait orientation, no people, abstract spiritual background`;
      }

      console.log('Step 1: Generating atmosphere with google/nano-banana...');
      
      const atmosRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/nano-banana',
          input: {
            prompt: generatedAtmospherePrompt + '. Ultra high resolution, 9:16 aspect ratio.',
            aspect_ratio: '9:16',
          },
        }),
      });

      if (!atmosRes.ok) {
        const errText = await atmosRes.text();
        throw new Error(`Atmosphere generation failed: ${atmosRes.status} - ${errText}`);
      }

      const atmosData = await atmosRes.json();
      const atmosTaskId = atmosData.data?.taskId;
      if (!atmosTaskId) throw new Error('No taskId for atmosphere: ' + JSON.stringify(atmosData));

      console.log('Atmosphere task created:', atmosTaskId);
      const atmosImageUrl = await pollTaskStatus(atmosTaskId, kieApiKey);

      const atmosPath = `covers/${videoId}/atmosphere_${Date.now()}.png`;
      atmosphereStorageUrl = await downloadAndUpload(atmosImageUrl, supabase, atmosPath);

      finalAtmospherePrompt = generatedAtmospherePrompt;

      await supabase.from('videos').update({
        atmosphere_url: atmosphereStorageUrl,
        atmosphere_prompt: finalAtmospherePrompt,
        cover_status: 'atmosphere_ready',
      }).eq('id', videoId);

      // Save atmosphere variant to cover_thumbnails
      // First, deactivate all previous atmosphere variants for this video
      await supabase.from('cover_thumbnails')
        .update({ is_active: false })
        .eq('video_id', videoId)
        .eq('variant_type', 'atmosphere');

      // Insert new atmosphere variant as active
      await supabase.from('cover_thumbnails').insert({
        video_id: videoId,
        atmosphere_url: atmosphereStorageUrl,
        prompt: finalAtmospherePrompt,
        variant_type: 'atmosphere',
        is_active: true,
        status: 'ready',
      });

      console.log('Atmosphere saved:', atmosphereStorageUrl);

      // If only atmosphere step requested, return here
      if (step === 'atmosphere') {
        return new Response(
          JSON.stringify({ success: true, step: 'atmosphere', atmosphereUrl: atmosphereStorageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =============================================
    // STEP 2: Overlay advisor photo onto atmosphere
    // =============================================

    if (!atmosphereStorageUrl) {
      throw new Error('No atmosphere image available. Generate atmosphere first (step 1).');
    }

    if (!advisorPhotoUrl) {
      console.log('No advisor photo found, skipping overlay step');
      // Use atmosphere as final cover
      await supabase.from('videos').update({
        front_cover_url: atmosphereStorageUrl,
        cover_status: 'ready',
      }).eq('id', videoId);
    } else {
      console.log('Step 2: Overlaying advisor photo with nano-banana-pro...');
      
      const overlayPrompt = `Take this background atmosphere image and composite a circular portrait of the person from the second image into the bottom-left corner of the background. The portrait should be in a clean circle shape, about 30% of the image width. Add the name "${video.advisor?.display_name || video.advisor?.name || ''}" as elegant text near the portrait. Keep the background atmosphere intact. 9:16 portrait orientation.`;

      const overlayRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'nano-banana-pro',
          input: {
            prompt: overlayPrompt,
            image_input: [atmosphereStorageUrl, advisorPhotoUrl],
            aspect_ratio: '9:16',
          },
        }),
      });

      if (!overlayRes.ok) {
        const errText = await overlayRes.text();
        throw new Error(`Overlay generation failed: ${overlayRes.status} - ${errText}`);
      }

      const overlayData = await overlayRes.json();
      const overlayTaskId = overlayData.data?.taskId;
      if (!overlayTaskId) throw new Error('No taskId for overlay: ' + JSON.stringify(overlayData));

      console.log('Overlay task created:', overlayTaskId);
      const overlayImageUrl = await pollTaskStatus(overlayTaskId, kieApiKey);
      console.log('Overlay generated:', overlayImageUrl);

      // Download and upload final cover
      const coverPath = `covers/${videoId}/front_cover_${Date.now()}.png`;
      const frontCoverUrl = await downloadAndUpload(overlayImageUrl, supabase, coverPath);

      // Update video with final cover
      await supabase.from('videos').update({
        front_cover_url: frontCoverUrl,
        cover_status: 'ready',
        cover_prompt: finalAtmospherePrompt,
      }).eq('id', videoId);

      // Deactivate previous cover variants
      await supabase.from('cover_thumbnails')
        .update({ is_active: false })
        .eq('video_id', videoId)
        .eq('variant_type', 'cover');

      // Save new cover variant as active
      await supabase.from('cover_thumbnails').insert({
        video_id: videoId,
        prompt: finalAtmospherePrompt,
        front_cover_url: frontCoverUrl,
        variant_type: 'cover',
        is_active: true,
        status: 'ready',
      });

      console.log('Final cover saved:', frontCoverUrl);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Cover generated (2-step process)' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating cover:', errorMessage);

    try {
      if (requestBody?.videoId) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('videos').update({ cover_status: 'error' }).eq('id', requestBody.videoId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
