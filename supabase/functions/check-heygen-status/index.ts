import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  videoProjectId: string;
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 502/503/504, retry after delay
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
  
  throw lastError || new Error('HeyGen API временно недоступен');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoProjectId } = await req.json() as StatusRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video project
    const { data: project, error: projectError } = await supabase
      .from('video_projects')
      .select('*')
      .eq('id', videoProjectId)
      .single();

    if (projectError || !project) {
      throw new Error('Video project not found');
    }

    if (!project.heygen_video_id) {
      throw new Error('No HeyGen video ID found');
    }

    console.log(`Checking HeyGen status for: ${project.heygen_video_id}`);

    // Check HeyGen video status with retry
    const response = await fetchWithRetry(
      `https://api.heygen.com/v1/video_status.get?video_id=${project.heygen_video_id}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': heygenKey,
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen status error:', errorText);
      
      if (response.status >= 500) {
        // Don't fail completely for server errors - return current status
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'processing',
            projectStatus: project.status,
            progress: project.progress,
            message: 'HeyGen API временно недоступен, проверка будет повторена'
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

    let newStatus = project.status;
    let progress = project.progress;

    if (status === 'completed' && videoUrl) {
      newStatus = 'ready';
      progress = 100;

      await supabase
        .from('video_projects')
        .update({ 
          status: newStatus,
          progress,
          heygen_video_url: videoUrl,
          final_video_url: videoUrl,
          duration: duration ? Math.round(duration) : null
        })
        .eq('id', videoProjectId);

      // Log activity
      await supabase.from('activity_log').insert({
        action: 'video_ready',
        entity_type: 'video_project',
        entity_id: videoProjectId,
        details: { video_url: videoUrl, duration }
      });

    } else if (status === 'processing') {
      progress = Math.min(95, project.progress + 5);
      await supabase
        .from('video_projects')
        .update({ progress })
        .eq('id', videoProjectId);

    } else if (status === 'failed') {
      await supabase
        .from('video_projects')
        .update({ 
          status: 'pending',
          error_message: result.data?.error || 'Video generation failed'
        })
        .eq('id', videoProjectId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        videoUrl,
        projectStatus: newStatus,
        progress
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
