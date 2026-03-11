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
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    const heygenKey = Deno.env.get('HEYGEN_API_KEY');

    const results: Record<string, any> = {};

    const promises: Promise<void>[] = [];

    if (elevenLabsKey) {
      promises.push(
        fetch('https://api.elevenlabs.io/v1/user/subscription', {
          headers: { 'xi-api-key': elevenLabsKey },
        })
          .then(r => r.json())
          .then(data => {
            results.elevenlabs = {
              used: data.character_count ?? 0,
              limit: data.character_limit ?? 0,
              resetUnix: data.next_character_count_reset_unix ?? null,
              tier: data.tier ?? null,
            };
          })
          .catch(e => {
            results.elevenlabs = { error: e.message };
          })
      );
    } else {
      results.elevenlabs = { error: 'API key not configured' };
    }

    if (heygenKey) {
      promises.push(
        fetch('https://api.heygen.com/v2/user/remaining_quota', {
          headers: { 'X-Api-Key': heygenKey },
        })
          .then(r => r.json())
          .then(data => {
            const seconds = data?.data?.remaining_quota ?? 0;
            results.heygen = {
              remainingSeconds: seconds,
              remainingCredits: Math.floor(seconds / 60),
            };
          })
          .catch(e => {
            results.heygen = { error: e.message };
          })
      );
    } else {
      results.heygen = { error: 'API key not configured' };
    }

    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, balances: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
