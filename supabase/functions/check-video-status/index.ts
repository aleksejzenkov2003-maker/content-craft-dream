import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  videoId: string;
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status >= 500 && response.status < 600) {
        console.log(`Server error ${response.status}, attempt ${i + 1}/${retries}`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${i + 1} failed: ${lastError.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('HeyGen API temporarily unavailable');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json() as StatusRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
    }

    if (!video.heygen_video_id) {
      throw new Error('No HeyGen video ID found');
    }

    console.log(`Checking HeyGen status for: ${video.heygen_video_id}`);

    // Check HeyGen video status with retry
    const response = await fetchWithRetry(
      `https://api.heygen.com/v1/video_status.get?video_id=${video.heygen_video_id}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': heygenKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen status error:', errorText);
      
      if (response.status >= 500) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'processing',
            currentStatus: video.generation_status,
            message: 'HeyGen API temporarily unavailable, will retry',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const result = await response.json();
    const status = result.data?.status;
    const videoUrl = result.data?.video_url;
    const duration = result.data?.duration;

    console.log('HeyGen status:', status, videoUrl);

    let newStatus = video.generation_status;

    if (status === 'completed' && videoUrl) {
      newStatus = 'ready';

      await supabase
        .from('videos')
        .update({ 
          generation_status: newStatus,
          heygen_video_url: videoUrl,
        })
        .eq('id', videoId);

      // Log activity
      await supabase.from('activity_log').insert({
        action: 'video_ready',
        entity_type: 'video',
        entity_id: videoId,
        details: { video_url: videoUrl, duration },
      });

    } else if (status === 'failed') {
      newStatus = 'error';
      await supabase
        .from('videos')
        .update({ 
          generation_status: 'error',
        })
        .eq('id', videoId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: status === 'completed' ? 'ready' : status === 'failed' ? 'error' : 'generating',
        videoUrl,
        currentStatus: newStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Status check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
