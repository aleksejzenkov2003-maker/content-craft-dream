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
    const errorMessage = result.data?.error?.detail || result.data?.error?.message || result.error?.detail || result.error?.message || null;

    console.log('HeyGen status:', status, videoUrl, errorMessage ? `error=${errorMessage}` : '');

    let newStatus = video.generation_status;

    // Some HeyGen jobs may return failed while still having a playable url
    // either in the same response or already persisted in DB from a previous poll.
    const effectiveVideoUrl = videoUrl || video.heygen_video_url || null;
    const hasPlayableVideo = Boolean(effectiveVideoUrl);

    if ((status === 'completed' && hasPlayableVideo) || (status === 'failed' && hasPlayableVideo)) {
      if (status === 'failed' && hasPlayableVideo) {
        console.warn('HeyGen returned failed but a video URL exists; treating as ready');
      }

      newStatus = 'ready';

      await supabase
        .from('videos')
        .update({ 
          generation_status: newStatus,
          heygen_video_url: effectiveVideoUrl,
        })
        .eq('id', videoId);

      // Log activity
      await supabase.from('activity_log').insert({
        action: 'video_ready',
        entity_type: 'video',
        entity_id: videoId,
        details: { video_url: effectiveVideoUrl, duration },
      });

      // Auto-mark publications for concat if channel has back_cover_video_url
      try {
        const { data: pubs } = await supabase
          .from('publications')
          .select('id, channel_id')
          .eq('video_id', videoId)
          .in('publication_status', ['pending', 'checked']);

        if (pubs && pubs.length > 0) {
          const channelIds = [...new Set(pubs.map(p => p.channel_id).filter(Boolean))];
          const { data: channels } = await supabase
            .from('publishing_channels')
            .select('id, back_cover_video_url')
            .in('id', channelIds)
            .not('back_cover_video_url', 'is', null);

          if (channels && channels.length > 0) {
            const channelSet = new Set(channels.map(c => c.id));
            const pubsToConcat = pubs.filter(p => p.channel_id && channelSet.has(p.channel_id));
            
            if (pubsToConcat.length > 0) {
              await supabase
                .from('publications')
                .update({ publication_status: 'needs_concat' })
                .in('id', pubsToConcat.map(p => p.id));
              
              console.log(`Marked ${pubsToConcat.length} publications for concat`);
            }
          }
        }
      } catch (concatErr) {
        console.error('Error marking publications for concat:', concatErr);
      }

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
        status: newStatus === 'ready' ? 'ready' : newStatus === 'error' ? 'error' : 'generating',
        videoUrl: effectiveVideoUrl,
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
