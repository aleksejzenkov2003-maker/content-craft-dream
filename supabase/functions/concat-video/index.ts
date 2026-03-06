import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publication_id, main_video_url, back_cover_video_url } = await req.json();

    if (!publication_id) {
      return new Response(
        JSON.stringify({ error: "Missing publication_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("publications")
      .update({ publication_status: "concatenating", error_message: null })
      .eq("id", publication_id);

    // ── Resolve fresh main video URL (HeyGen signed URLs expire) ──
    let resolvedMainUrl = main_video_url;
    const { data: pubData } = await supabase
      .from("publications")
      .select("video_id")
      .eq("id", publication_id)
      .single();

    if (pubData?.video_id) {
      const { data: videoData } = await supabase
        .from("videos")
        .select("heygen_video_url, heygen_video_id, video_path")
        .eq("id", pubData.video_id)
        .single();

      if (videoData?.heygen_video_id) {
        const heygenKey = Deno.env.get("HEYGEN_API_KEY");
        if (heygenKey) {
          try {
            console.log(`Fetching fresh URL from HeyGen API for video: ${videoData.heygen_video_id}`);
            const heygenResp = await fetch(
              `https://api.heygen.com/v1/video_status.get?video_id=${videoData.heygen_video_id}`,
              { headers: { "X-Api-Key": heygenKey } }
            );
            if (heygenResp.ok) {
              const heygenData = await heygenResp.json();
              const freshUrl = heygenData?.data?.video_url;
              if (freshUrl) {
                console.log(`Got fresh HeyGen URL: ${freshUrl.substring(0, 80)}...`);
                resolvedMainUrl = freshUrl;
                await supabase.from("videos")
                  .update({ heygen_video_url: freshUrl })
                  .eq("id", pubData.video_id);
              }
            } else {
              console.log(`HeyGen API returned ${heygenResp.status}, falling back to stored URL`);
              await heygenResp.text();
            }
          } catch (e) {
            console.log(`HeyGen API error: ${e.message}, falling back to stored URL`);
          }
        }
      }

      if (resolvedMainUrl === main_video_url) {
        const storedUrl = videoData?.heygen_video_url || videoData?.video_path;
        if (storedUrl) resolvedMainUrl = storedUrl;
      }
    }

    // ── No back cover — just use main video ──
    if (!back_cover_video_url) {
      console.log("No back cover, using main video as final");
      await supabase.from("publications")
        .update({ final_video_url: resolvedMainUrl, publication_status: "checked" })
        .eq("id", publication_id);
      return new Response(
        JSON.stringify({ success: true, final_video_url: resolvedMainUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Send to n8n for FFmpeg-based concatenation ──
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      throw new Error("N8N_WEBHOOK_URL is not configured");
    }

    // Build the storage path where n8n should upload the result
    const outputFileName = `concat/${publication_id}_${Date.now()}.mp4`;
    const storageUploadUrl = `${supabaseUrl}/storage/v1/object/media-files/${outputFileName}`;

    console.log(`Sending concat request to n8n webhook...`);
    console.log(`Main video: ${resolvedMainUrl.substring(0, 80)}...`);
    console.log(`Back cover: ${back_cover_video_url.substring(0, 80)}...`);
    console.log(`Output path: ${outputFileName}`);

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publication_id,
        main_video_url: resolvedMainUrl,
        back_cover_video_url,
        output_file_name: outputFileName,
        storage_upload_url: storageUploadUrl,
        supabase_url: supabaseUrl,
        supabase_service_key: supabaseKey,
      }),
    });

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text();
      throw new Error(`n8n webhook returned ${n8nResponse.status}: ${errText}`);
    }

    const n8nResult = await n8nResponse.json();
    console.log("n8n response:", JSON.stringify(n8nResult));

    // n8n should return the final URL of the uploaded video
    const finalUrl = n8nResult.final_video_url
      || n8nResult.url
      || n8nResult.publicUrl;

    if (!finalUrl) {
      // If n8n handled upload but didn't return URL, construct it
      const { data: urlData } = supabase.storage
        .from("media-files")
        .getPublicUrl(outputFileName);

      const constructedUrl = urlData.publicUrl;
      console.log(`Constructed final URL: ${constructedUrl}`);

      await supabase.from("publications")
        .update({ final_video_url: constructedUrl, publication_status: "checked" })
        .eq("id", publication_id);

      return new Response(
        JSON.stringify({ success: true, final_video_url: constructedUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Final URL from n8n: ${finalUrl}`);
    await supabase.from("publications")
      .update({ final_video_url: finalUrl, publication_status: "checked" })
      .eq("id", publication_id);

    return new Response(
      JSON.stringify({ success: true, final_video_url: finalUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("concat-video error:", error);

    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.publication_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("publications")
          .update({ publication_status: "needs_concat", error_message: error.message })
          .eq("id", body.publication_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
