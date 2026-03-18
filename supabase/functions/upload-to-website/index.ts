import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WEBSITE_BASE_URL = 'https://www.wisdomdialogue.ai';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { publicationId } = await req.json();
    if (!publicationId) {
      return new Response(JSON.stringify({ error: 'publicationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const WEBSITE_API_TOKEN = Deno.env.get('WEBSITE_API_TOKEN');
    if (!WEBSITE_API_TOKEN) {
      throw new Error('WEBSITE_API_TOKEN is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch publication with video data
    const { data: publication, error: pubError } = await supabase
      .from('publications')
      .select(`
        *,
        video:videos (id, question_id, advisor_id, video_path, heygen_video_url, final_video_url, video_title),
        channel:publishing_channels (id, name, network_type)
      `)
      .eq('id', publicationId)
      .single();

    if (pubError || !publication) {
      throw new Error(`Publication not found: ${pubError?.message}`);
    }

    const video = publication.video;
    if (!video) {
      throw new Error('No video linked to this publication');
    }

    const questionId = video.question_id;
    const advisorId = video.advisor_id;
    if (!questionId || !advisorId) {
      throw new Error(`Missing question_id (${questionId}) or advisor_id (${advisorId})`);
    }

    // Determine video URL: final_video_url from publication, or video_path/heygen from video
    const videoUrl = publication.final_video_url || video.video_path || video.heygen_video_url;
    if (!videoUrl) {
      throw new Error('No video URL available for upload');
    }

    // Update status to uploading
    await supabase
      .from('publications')
      .update({ publication_status: 'uploading', error_message: null })
      .eq('id', publicationId);

    console.log(`[upload-to-website] Downloading video from: ${videoUrl}`);

    // 2. Download video file
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBlob = await videoResponse.blob();
    const fileSize = videoBlob.size;
    console.log(`[upload-to-website] Video downloaded, size: ${fileSize} bytes`);

    // 3. Request upload link from website API
    const uploadApiUrl = `${WEBSITE_BASE_URL}/api/admin/video-guides/${questionId}/guide/${advisorId}/upload`;
    console.log(`[upload-to-website] Requesting upload link: ${uploadApiUrl}`);

    const uploadRequest = await fetch(uploadApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEBSITE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: `video-${questionId}-${advisorId}.mp4`,
        fileSize: fileSize,
      }),
    });

    if (!uploadRequest.ok) {
      const errorText = await uploadRequest.text();
      throw new Error(`Website API upload request failed [${uploadRequest.status}]: ${errorText}`);
    }

    const uploadData = await uploadRequest.json();
    const { uploadLink, embedUrl, vimeoVideoId } = uploadData;
    console.log(`[upload-to-website] Got upload link, vimeoVideoId: ${vimeoVideoId}, embedUrl: ${embedUrl}`);

    if (!uploadLink) {
      throw new Error('No uploadLink received from website API');
    }

    // 4. Upload video via TUS protocol
    console.log(`[upload-to-website] Uploading video via TUS to: ${uploadLink}`);
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoUint8 = new Uint8Array(videoArrayBuffer);

    const tusResponse = await fetch(uploadLink, {
      method: 'PUT',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: videoUint8,
    });

    if (!tusResponse.ok && tusResponse.status !== 204) {
      const tusError = await tusResponse.text();
      throw new Error(`TUS upload failed [${tusResponse.status}]: ${tusError}`);
    }

    console.log(`[upload-to-website] TUS upload complete, status: ${tusResponse.status}`);

    // 5. Update publication with embed URL and published status
    await supabase
      .from('publications')
      .update({
        post_url: embedUrl || `https://player.vimeo.com/video/${vimeoVideoId}`,
        publication_status: 'published',
        error_message: null,
      })
      .eq('id', publicationId);

    // 6. Log activity
    const durationMs = Date.now() - startTime;
    await supabase.from('activity_log').insert({
      action: 'upload_to_website',
      entity_type: 'publication',
      entity_id: publicationId,
      parent_entity_id: video.id,
      duration_ms: durationMs,
      details: {
        questionId,
        advisorId,
        vimeoVideoId,
        embedUrl,
        fileSize,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      embedUrl,
      vimeoVideoId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[upload-to-website] Error:', error);

    // Try to update publication status on error
    try {
      const { publicationId } = await req.clone().json().catch(() => ({}));
      if (publicationId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('publications')
          .update({
            publication_status: 'error',
            error_message: (error as Error).message?.substring(0, 500),
          })
          .eq('id', publicationId);
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      error: error.message || 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
