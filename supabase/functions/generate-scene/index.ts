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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let targetSceneId: string | null = null;

  try {
    const { sceneId, playlistId, advisorId, prompt } = await req.json();

    if (!sceneId && (!playlistId || !advisorId)) {
      throw new Error('Scene ID or Playlist ID + Advisor ID required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiKey = Deno.env.get('KIE_API_KEY');

    if (!kieApiKey) throw new Error('KIE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    targetSceneId = sceneId || null;

    // If no sceneId, create a new scene
    if (!sceneId) {
      const { data: newScene, error: createError } = await supabase
        .from('playlist_scenes')
        .insert({
          playlist_id: playlistId,
          advisor_id: advisorId,
          scene_prompt: prompt,
          status: 'generating'
        })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create scene: ${createError.message}`);
      targetSceneId = newScene.id;
    } else {
      await supabase
        .from('playlist_scenes')
        .update({ status: 'generating' })
        .eq('id', sceneId);
    }

    // Get playlist and advisor info for prompt building
    let playlistName = '';
    if (playlistId) {
      const { data: playlist } = await supabase
        .from('playlists')
        .select('name, scene_prompt')
        .eq('id', playlistId)
        .single();
      playlistName = playlist?.name || '';
    }

    let advisorName = '';
    if (advisorId) {
      const { data: advisor } = await supabase
        .from('advisors')
        .select('name, display_name')
        .eq('id', advisorId)
        .single();
      advisorName = advisor?.display_name || advisor?.name || '';
    }

    // Build prompt
    let scenePrompt = prompt;
    if (!scenePrompt) {
      const { data: dbPrompt } = await supabase
        .from('prompts')
        .select('user_template')
        .eq('type', 'scene')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (dbPrompt) {
        scenePrompt = dbPrompt.user_template
          .replace(/\{\{playlist\}\}/g, playlistName || 'Spiritual guidance')
          .replace(/\{\{advisor\}\}/g, advisorName || '');
      } else {
        scenePrompt = `Create a beautiful background scene for a spiritual guidance video.
Theme: ${playlistName || 'Spiritual guidance'}
Style: Photorealistic, cinematic lighting, soft bokeh background.
Colors: Warm, inviting tones with subtle golden light.
Ultra high resolution, 9:16 aspect ratio.`;
      }
    }

    console.log('Generating scene via Kie.ai, prompt:', scenePrompt);

    // Create task via Kie.ai API
    const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt: `${scenePrompt}\nUltra high resolution, professional quality.`,
          aspect_ratio: '9:16',
          output_format: 'png',
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Kie.ai createTask error:', errText);
      throw new Error(`Kie.ai createTask error: ${createRes.status} - ${errText}`);
    }

    const createData = await createRes.json();
    const taskId = createData.data?.taskId;

    if (!taskId) {
      throw new Error('No taskId returned from Kie.ai: ' + JSON.stringify(createData));
    }

    console.log('Kie.ai task created:', taskId);

    // Poll for completion
    const generatedImageUrl = await pollTaskStatus(taskId, kieApiKey);
    console.log('Scene image generated, URL:', generatedImageUrl);

    // Download the image
    const imageRes = await fetch(generatedImageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download image: ${imageRes.status}`);
    }
    const imageBuffer = new Uint8Array(await imageRes.arrayBuffer());

    // Upload to storage
    const fileName = `scenes/${targetSceneId}/scene_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from('media-files')
      .getPublicUrl(fileName);

    const sceneUrl = urlData.publicUrl;

    // Update scene with the new URL
    const { error: updateError } = await supabase
      .from('playlist_scenes')
      .update({
        status: 'approved',
        scene_url: sceneUrl,
        scene_prompt: prompt || scenePrompt
      })
      .eq('id', targetSceneId);

    if (updateError) throw new Error(`Failed to update scene: ${updateError.message}`);

    console.log('Scene generated and saved:', sceneUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sceneId: targetSceneId,
        sceneUrl,
        message: 'Scene generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating scene:', errorMessage);

    // Try to reset scene status
    if (targetSceneId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('playlist_scenes')
          .update({ status: 'cancelled' })
          .eq('id', targetSceneId);
      } catch (e) {
        console.error('Failed to update error status:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
