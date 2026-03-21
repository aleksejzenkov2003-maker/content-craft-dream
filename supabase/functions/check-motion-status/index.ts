import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const READY_STATUSES = new Set(['completed', 'active']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { motionAvatarId, videoId } = await req.json();

    if (!motionAvatarId) {
      return new Response(
        JSON.stringify({ ready: false, error: 'No motionAvatarId provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;

    const res = await fetch(`https://api.heygen.com/v2/photo_avatar/${motionAvatarId}`, {
      headers: { 'X-Api-Key': heygenKey },
    });

    if (res.status === 404) {
      return new Response(
        JSON.stringify({ ready: false, status: 'not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let status = 'unknown';
    if (res.ok) {
      const data = await res.json();
      status = data?.data?.status || 'unknown';
    }

    const ready = READY_STATUSES.has(status);

    // If ready and videoId provided, update the video record
    if (ready && videoId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase.from('activity_log').insert({
          action: 'motion_ready_confirmed',
          entity_type: 'video',
          entity_id: videoId,
          details: { motion_avatar_id: motionAvatarId, status },
        });
      } catch (e) {
        console.warn('Failed to log motion ready:', e);
      }
    }

    return new Response(
      JSON.stringify({ ready, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ready: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
