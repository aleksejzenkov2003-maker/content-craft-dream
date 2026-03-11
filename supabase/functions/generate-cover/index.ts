import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import React from "https://esm.sh/react@18.2.0";
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";

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

async function uploadBuffer(
  buffer: Uint8Array,
  supabase: any,
  path: string,
  contentType = 'image/png'
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from('media-files')
    .upload(path, buffer, { contentType, upsert: true });

  if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Step 2: Programmatic cover compositing using og_edge (Satori).
 * Composites: atmosphere background + circular advisor photo + hook text.
 */
async function composeCover(
  atmosphereUrl: string,
  advisorPhotoUrl: string | null,
  advisorName: string,
  hookText: string,
): Promise<ArrayBuffer> {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const element = React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        fontFamily: 'Montserrat, sans-serif',
      },
    },
    // Background atmosphere image
    React.createElement('img', {
      src: atmosphereUrl,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      },
    }),
    // Dark gradient overlay for text readability
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.55) 100%)',
      },
    }),
    // Advisor photo — no border, no name label
    advisorPhotoUrl
      ? React.createElement('img', {
          src: advisorPhotoUrl,
          style: {
            position: 'absolute',
            top: 100,
            left: 100,
            width: 350,
            height: 618,
            borderRadius: 24,
            objectFit: 'cover',
            zIndex: 10,
          },
        })
      : null,
    // Hook text — large, centered, with text stroke effect
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 750,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '0 50px',
          zIndex: 10,
        },
      },
      // Shadow layer for stroke effect
      React.createElement(
        'div',
        {
          style: {
            color: 'white',
            fontSize: hookText.length > 80 ? 64 : hookText.length > 40 ? 72 : 80,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.25,
            maxWidth: '100%',
            textShadow: '0 0 12px rgba(0,0,0,0.9)',
          },
        },
        hookText
      )
    )
  );

  // Load Montserrat font
  let fonts: any[] = [];
  try {
    const fontUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-900-normal.ttf';
    const fontResp = await fetch(fontUrl, { redirect: 'follow' });
    if (!fontResp.ok) throw new Error(`Font fetch failed: ${fontResp.status}`);
    const contentType = fontResp.headers.get('content-type') || '';
    if (contentType.includes('html')) throw new Error('Font URL returned HTML');
    const fontData = await fontResp.arrayBuffer();
    if (fontData.byteLength < 1000) throw new Error('Font data too small');
    fonts = [{ name: 'Montserrat', data: fontData, weight: 900, style: 'normal' }];
    console.log(`Montserrat font loaded: ${fontData.byteLength} bytes`);
  } catch (e) {
    console.warn('Failed to load Montserrat font, falling back to default:', e);
  }

  const response = new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts.length > 0 ? fonts : undefined,
  });

  return response.arrayBuffer();
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

    // Fetch video + advisor + playlist
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        *,
        advisor:advisors (id, name, display_name, thumbnail_photo_id),
        playlist:playlists (id, name)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    // Get advisor photo for cover: priority thumbnail_photo_id → is_primary → any photo
    let advisorPhotoUrl: string | null = null;
    if (video.advisor_id) {
      // 1. Try thumbnail_photo_id from advisor settings
      if (video.advisor?.thumbnail_photo_id) {
        const { data: thumbPhoto } = await supabase
          .from('advisor_photos')
          .select('photo_url')
          .eq('id', video.advisor.thumbnail_photo_id)
          .single();
        advisorPhotoUrl = thumbPhoto?.photo_url || null;
        console.log('Using thumbnail_photo_id photo:', advisorPhotoUrl ? 'found' : 'not found');
      }

      // 2. Fallback to is_primary
      if (!advisorPhotoUrl) {
        const { data: photos } = await supabase
          .from('advisor_photos')
          .select('photo_url')
          .eq('advisor_id', video.advisor_id)
          .eq('is_primary', true)
          .limit(1);
        advisorPhotoUrl = photos?.[0]?.photo_url || null;
      }

      // 3. Fallback to any photo
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
    // STEP 1: Generate atmosphere background (AI)
    // =============================================
    if (runAtmosphere) {
      let generatedAtmospherePrompt = atmospherePrompt;

      if (!generatedAtmospherePrompt) {
        // Fetch active atmosphere prompt from DB
        const { data: dbPrompt } = await supabase
          .from('prompts')
          .select('system_prompt, user_template')
          .eq('type', 'atmosphere')
          .eq('is_active', true)
          .limit(1)
          .single();

        const advisorName = video.advisor?.display_name || video.advisor?.name || '';
        const playlistName = video.playlist?.name || '';

        if (dbPrompt && lovableApiKey) {
          const systemPrompt = dbPrompt.system_prompt;
          const userPrompt = dbPrompt.user_template
            .replace(/\{\{question\}\}/g, video.question || '')
            .replace(/\{\{hook\}\}/g, video.hook || '')
            .replace(/\{\{answer\}\}/g, video.advisor_answer || '')
            .replace(/\{\{advisor\}\}/g, advisorName)
            .replace(/\{\{playlist\}\}/g, playlistName);

          console.log('Generating atmosphere prompt via AI from DB prompt...');
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            generatedAtmospherePrompt = aiData.choices?.[0]?.message?.content?.trim() || '';
            console.log('AI generated atmosphere prompt:', generatedAtmospherePrompt);
          }
        } else if (lovableApiKey) {
          // Fallback hardcoded if no DB prompt
          console.log('No DB prompt found, using hardcoded fallback...');
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
                  content: `You are a visual concept designer. Generate a short, vivid prompt for an atmospheric background image for a spiritual video cover. The image should NOT contain any people or faces - only atmosphere, scenery, and mood. Output ONLY the image generation prompt, nothing else. Keep it under 100 words. The prompt should be in English.`
                },
                {
                  role: 'user',
                  content: `Create an atmosphere background prompt for:\nQuestion: ${video.question || ''}\nHook: ${video.hook || ''}\nAnswer: ${video.advisor_answer || ''}\nAdvisor: ${advisorName}\nReligion/Topic: ${playlistName}\n\nThe background should evoke the spiritual and emotional tone of this content.`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            generatedAtmospherePrompt = aiData.choices?.[0]?.message?.content?.trim() || '';
          }
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
      await supabase.from('cover_thumbnails')
        .update({ is_active: false })
        .eq('video_id', videoId)
        .eq('variant_type', 'atmosphere');

      await supabase.from('cover_thumbnails').insert({
        video_id: videoId,
        atmosphere_url: atmosphereStorageUrl,
        prompt: finalAtmospherePrompt,
        variant_type: 'atmosphere',
        is_active: true,
        status: 'ready',
      });

      console.log('Atmosphere saved:', atmosphereStorageUrl);

      if (step === 'atmosphere') {
        return new Response(
          JSON.stringify({ success: true, step: 'atmosphere', atmosphereUrl: atmosphereStorageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =============================================
    // STEP 2: Programmatic cover compositing
    // (atmosphere + circular advisor photo + hook text)
    // =============================================

    if (!atmosphereStorageUrl) {
      throw new Error('No atmosphere image available. Generate atmosphere first (step 1).');
    }

    const advisorName = video.advisor?.display_name || video.advisor?.name || '';
    const hookText = video.question_eng || video.hook || video.question || '';

    console.log('Step 2: Compositing cover programmatically...');
    console.log('  Atmosphere:', atmosphereStorageUrl);
    console.log('  Advisor photo:', advisorPhotoUrl);
    console.log('  Hook text:', hookText);

    const coverBuffer = await composeCover(
      atmosphereStorageUrl,
      advisorPhotoUrl,
      advisorName,
      hookText,
    );

    const coverPath = `covers/${videoId}/front_cover_${Date.now()}.png`;
    const frontCoverUrl = await uploadBuffer(
      new Uint8Array(coverBuffer),
      supabase,
      coverPath,
    );

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

    // Save new cover variant
    await supabase.from('cover_thumbnails').insert({
      video_id: videoId,
      prompt: finalAtmospherePrompt,
      front_cover_url: frontCoverUrl,
      variant_type: 'cover',
      is_active: true,
      status: 'ready',
    });

    console.log('Final cover saved:', frontCoverUrl);

    return new Response(
      JSON.stringify({ success: true, message: 'Cover composed programmatically (2-step process)', frontCoverUrl }),
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
