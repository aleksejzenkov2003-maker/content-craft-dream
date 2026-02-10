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
      // Try kie.ai v2 format: resultJson with resultUrls
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

      // Fallback: try various output formats
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

  try {
    const { prompt, aspectRatio = '16:9', folder = 'generated' } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiKey = Deno.env.get('KIE_API_KEY');

    if (!kieApiKey) {
      throw new Error('KIE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const fullPrompt = `${prompt}\nUltra high resolution, professional quality.`;

    console.log('Generating image with kie.ai nano-banana-pro, prompt:', fullPrompt);

    // Create task via kie.ai API
    const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt: fullPrompt,
          aspect_ratio: aspectRatio,
          output_format: 'PNG',
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('kie.ai createTask error:', errText);

      if (createRes.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (createRes.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`kie.ai createTask error: ${createRes.status}`);
    }

    const createData = await createRes.json();
    const taskId = createData.data?.taskId;

    if (!taskId) {
      throw new Error('No taskId returned from kie.ai: ' + JSON.stringify(createData));
    }

    console.log('kie.ai task created:', taskId);

    // Poll for completion
    const generatedImageUrl = await pollTaskStatus(taskId, kieApiKey);
    console.log('Image generated, URL:', generatedImageUrl);

    // Download the image
    const imageRes = await fetch(generatedImageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download image: ${imageRes.status}`);
    }
    const imageBuffer = new Uint8Array(await imageRes.arrayBuffer());

    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

    const { error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('media-files')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    console.log('Image generated and uploaded:', imageUrl);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        message: 'Image generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating image:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
