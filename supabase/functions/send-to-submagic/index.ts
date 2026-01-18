import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendToSubmagicRequest {
  videoProjectId: string;
  templateName?: string;
  language?: string;
  magicBrollsPercentage?: number;
  removeSilencePace?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      videoProjectId, 
      templateName = "Hormozi 2",
      language = "ru",
      magicBrollsPercentage = 50,
      removeSilencePace = "fast"
    }: SendToSubmagicRequest = await req.json();

    console.log('Send to Submagic request:', { videoProjectId, templateName, language });

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

    // Get the video URL to send to Submagic
    const videoUrl = project.heygen_video_url || project.final_video_url || project.custom_video_url;
    
    console.log('Sending video to Submagic:', { videoUrl, templateName });

    // Truncate title to max 100 characters (Submagic limit)
    const truncatedTitle = (project.title || 'Video Project').substring(0, 100);

    // Send to Submagic API
    const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': submagicApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: truncatedTitle,
        language: language,
        videoUrl: videoUrl,
        templateName: templateName,
        magicZooms: true,
        magicBrolls: true,
        magicBrollsPercentage: magicBrollsPercentage,
        removeSilencePace: removeSilencePace,
      }),
    });

    if (!submagicResponse.ok) {
      const errorText = await submagicResponse.text();
      console.error('Submagic API error:', submagicResponse.status, errorText);
      throw new Error(`Submagic API error: ${submagicResponse.status} - ${errorText}`);
    }

    const submagicData = await submagicResponse.json();
    console.log('Submagic response:', submagicData);

    const submagicProjectId = submagicData.id || submagicData.projectId;

    if (!submagicProjectId) {
      throw new Error('No project ID returned from Submagic');
    }

    // Update the video project with Submagic project ID and status
    const { error: updateError } = await supabase
      .from('video_projects')
      .update({
        submagic_project_id: submagicProjectId,
        status: 'editing',
        progress: 75,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoProjectId);

    if (updateError) {
      console.error('Error updating project:', updateError);
      throw new Error(`Failed to update video project: ${updateError.message}`);
    }

    // Log activity
    await supabase.from('activity_log').insert({
      entity_type: 'video_project',
      entity_id: videoProjectId,
      action: 'sent_to_submagic',
      details: { submagicProjectId, templateName, language },
    });

    console.log('Successfully sent to Submagic:', { submagicProjectId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        submagicProjectId,
        message: 'Video sent to Submagic for editing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-to-submagic:', error);
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
