import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type Operation = 'concat' | 'overlay' | 'reduce' | 'subtitles' | 'normalize-audio';

interface ProcessRequest {
  operation: Operation;
  params: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { operation, params } = await req.json() as ProcessRequest;

    const vpsUrl = Deno.env.get('VPS_FFMPEG_URL');
    const vpsSecret = Deno.env.get('VPS_FFMPEG_SECRET');

    if (!vpsUrl) {
      throw new Error('VPS_FFMPEG_URL not configured');
    }

    const endpoint = `${vpsUrl}/api/ffmpeg/${operation}`;
    console.log(`Proxying ${operation} to VPS: ${endpoint}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (vpsSecret) {
      headers['Authorization'] = `Bearer ${vpsSecret}`;
    }

    // Long timeout for video processing (15 minutes)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        console.error(`VPS error (${response.status}):`, result);
        return new Response(
          JSON.stringify({ success: false, error: result.error || 'VPS processing failed', duration_ms: duration }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`${operation} completed in ${duration}ms`);
      return new Response(
        JSON.stringify({ ...result, duration_ms: duration }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Process video VPS error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, duration_ms: duration }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
