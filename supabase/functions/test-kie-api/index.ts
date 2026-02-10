import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const kieApiKey = Deno.env.get('KIE_API_KEY');
    if (!kieApiKey) {
      throw new Error('KIE_API_KEY not configured');
    }

    // Just create a task to verify the API key works, don't poll
    const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        modelId: 'nano-banana-pro',
        input: { prompt: 'test', aspect_ratio: '1:1' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid KIE_API_KEY');
      }
      throw new Error(`Kie.ai API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const taskId = result.data?.taskId;

    if (!taskId) {
      throw new Error('No taskId returned — unexpected API response');
    }

    console.log('Kie.ai API key valid, taskId:', taskId);

    return new Response(
      JSON.stringify({ success: true, message: 'API key is valid' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Test Kie API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
