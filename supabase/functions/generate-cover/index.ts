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
    const { videoId, prompt, advisorPhotoUrl, advisorName } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update video status to generating
    await supabase
      .from('videos')
      .update({ cover_status: 'generating' })
      .eq('id', videoId);

    // Build the prompt for cover generation
    const coverPrompt = prompt || `Create a professional YouTube thumbnail cover for a spiritual guidance video. 
The cover should feature a serene, contemplative atmosphere with soft lighting.
Include space for text overlay on the right side.
Style: Modern, clean, inspirational.
Advisor name: ${advisorName || 'Spiritual Advisor'}
Make it visually appealing for social media.
Ultra high resolution, 16:9 aspect ratio.`;

    console.log('Generating cover with prompt:', coverPrompt);

    // Generate image using Lovable AI
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
            content: coverPrompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      throw new Error('No image generated');
    }

    // Upload the base64 image to Supabase Storage
    const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `covers/${videoId}/front_cover_${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media-files')
      .getPublicUrl(fileName);

    const frontCoverUrl = urlData.publicUrl;

    // Update video with the new cover
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        cover_status: 'ready',
        front_cover_url: frontCoverUrl,
        cover_prompt: prompt
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Failed to update video: ${updateError.message}`);
    }

    // Also save to cover_thumbnails table for history
    await supabase
      .from('cover_thumbnails')
      .insert({
        video_id: videoId,
        prompt: coverPrompt,
        front_cover_url: frontCoverUrl,
        status: 'ready'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        frontCoverUrl,
        message: 'Cover generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating cover:', errorMessage);

    // Try to update status to error
    try {
      const { videoId } = await req.clone().json();
      if (videoId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('videos')
          .update({ cover_status: 'error' })
          .eq('id', videoId);
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
