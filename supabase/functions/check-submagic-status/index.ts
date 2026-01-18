import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckStatusRequest {
  videoProjectId: string;
}

// Helper function to retry API requests
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 2
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && i < retries) {
        console.log(`Server error ${response.status}, retrying... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries) {
        console.log(`Request failed, retrying... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoProjectId }: CheckStatusRequest = await req.json();

    console.log('Check Submagic status request:', { videoProjectId });

    if (!videoProjectId) {
      throw new Error('videoProjectId is required');
    }

    const submagicApiKey = Deno.env.get('SUBMAGIC_API_KEY');
    if (!submagicApiKey) {
      throw new Error('SUBMAGIC_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the video project
    const { data: project, error: fetchError } = await supabase
      .from('video_projects')
      .select('*')
      .eq('id', videoProjectId)
      .single();

    if (fetchError) {
      console.error('Error fetching project:', fetchError);
      throw new Error(`Failed to fetch video project: ${fetchError.message}`);
    }

    if (!project) {
      throw new Error('Video project not found');
    }

    if (!project.submagic_project_id) {
      throw new Error('Video project has no Submagic project ID');
    }

    console.log('Checking Submagic project:', project.submagic_project_id);

    // Check status from Submagic API
    const statusResponse = await fetchWithRetry(
      `https://api.submagic.co/v1/projects/${project.submagic_project_id}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': submagicApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Submagic API error:', statusResponse.status, errorText);
      throw new Error(`Submagic API error: ${statusResponse.status} - ${errorText}`);
    }

    const statusData = await statusResponse.json();
    console.log('Submagic status response:', statusData);

    // Map Submagic status to our system
    const submagicStatus = statusData.status?.toLowerCase() || 'processing';
    let newStatus = project.status;
    let progress = project.progress || 75;
    let submagicVideoUrl = project.submagic_video_url;
    let isEdited = project.is_edited || false;
    let duration = project.duration;

    if (submagicStatus === 'completed' || submagicStatus === 'done' || submagicStatus === 'ready') {
      // Video is ready
      submagicVideoUrl = statusData.downloadUrl || statusData.videoUrl || statusData.output_url || statusData.url;
      newStatus = 'ready';
      progress = 100;
      isEdited = true;
      
      if (statusData.duration) {
        duration = Math.round(statusData.duration);
      }

      console.log('Submagic video completed:', { submagicVideoUrl, duration });
    } else if (submagicStatus === 'failed' || submagicStatus === 'error') {
      // Video generation failed
      const errorMessage = statusData.error || statusData.message || 'Submagic editing failed';
      
      await supabase
        .from('video_projects')
        .update({
          status: 'ready', // Revert to ready so user can try again
          error_message: errorMessage,
          progress: 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoProjectId);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'failed',
          error: errorMessage,
          project: { ...project, status: 'ready', error_message: errorMessage }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Still processing
      progress = Math.min(progress + 5, 95);
      console.log('Submagic still processing:', { submagicStatus, progress });
    }

    // Update the video project
    const updateData: Record<string, unknown> = {
      progress,
      updated_at: new Date().toISOString(),
    };

    if (newStatus !== project.status) {
      updateData.status = newStatus;
    }

    if (submagicVideoUrl && submagicVideoUrl !== project.submagic_video_url) {
      updateData.submagic_video_url = submagicVideoUrl;
      updateData.final_video_url = submagicVideoUrl; // Update final video URL to edited version
    }

    if (isEdited !== project.is_edited) {
      updateData.is_edited = isEdited;
    }

    if (duration && duration !== project.duration) {
      updateData.duration = duration;
    }

    const { error: updateError } = await supabase
      .from('video_projects')
      .update(updateData)
      .eq('id', videoProjectId);

    if (updateError) {
      console.error('Error updating project:', updateError);
      throw new Error(`Failed to update video project: ${updateError.message}`);
    }

    // Log activity if completed
    if (isEdited && !project.is_edited) {
      await supabase.from('activity_log').insert({
        entity_type: 'video_project',
        entity_id: videoProjectId,
        action: 'submagic_completed',
        details: { submagicVideoUrl, duration },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: submagicStatus,
        videoUrl: submagicVideoUrl,
        isEdited,
        progress,
        duration,
        project: {
          ...project,
          ...updateData,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-submagic-status:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
