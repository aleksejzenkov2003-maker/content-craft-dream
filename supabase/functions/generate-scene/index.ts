import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneId, playlistId, advisorId, prompt, advisorPhotoUrl } = await req.json();

    if (!sceneId && (!playlistId || !advisorId)) {
      throw new Error('Scene ID or Playlist ID + Advisor ID required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetSceneId = sceneId;

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

      if (createError) {
        throw new Error(`Failed to create scene: ${createError.message}`);
      }

      targetSceneId = newScene.id;
    } else {
      // Update existing scene status
      await supabase
        .from('playlist_scenes')
        .update({ status: 'generating' })
        .eq('id', sceneId);
    }

    // Get playlist and advisor info for context
    let playlistName = '';
    let advisorName = '';

    if (playlistId) {
      const { data: playlist } = await supabase
        .from('playlists')
        .select('name, scene_prompt')
        .eq('id', playlistId)
        .single();
      
      playlistName = playlist?.name || '';
    }

    if (advisorId) {
      const { data: advisor } = await supabase
        .from('advisors')
        .select('name, display_name')
        .eq('id', advisorId)
        .single();
      
      advisorName = advisor?.display_name || advisor?.name || '';
    }

    // Build the prompt for scene generation
    const scenePrompt = prompt || `Create a beautiful background scene for a spiritual guidance video.
The scene should be serene, peaceful, and contemplative.
Theme: ${playlistName || 'Spiritual guidance'}
Style: Photorealistic, cinematic lighting, soft bokeh background.
The image should work as a video backdrop with the advisor appearing in front.
Colors: Warm, inviting tones with subtle golden light.
Ultra high resolution, 16:9 aspect ratio.`;

    console.log('Generating scene with prompt:', scenePrompt);

    // If we have an advisor photo, we can use edit_image to composite them
    let finalImageUrl: string;

    if (advisorPhotoUrl) {
      // Edit image to place advisor in scene
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Place this person in a beautiful serene background scene suitable for a spiritual guidance video. 
The background should be ${scenePrompt}. 
Keep the person clearly visible and well-lit.
Make it look natural and professional.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: advisorPhotoUrl
                  }
                }
              ]
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      finalImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    } else {
      // Generate just the background scene
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: scenePrompt
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      finalImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }

    if (!finalImageUrl) {
      throw new Error('No image generated');
    }

    // Upload to storage
    const base64Data = finalImageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `scenes/${targetSceneId}/scene_${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
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

    if (updateError) {
      throw new Error(`Failed to update scene: ${updateError.message}`);
    }

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

    // Try to update status to error
    try {
      const body = await req.clone().json();
      if (body.sceneId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('playlist_scenes')
          .update({ status: 'cancelled' })
          .eq('id', body.sceneId);
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
