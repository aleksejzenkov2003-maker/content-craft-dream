import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const uploadPostApiKey = Deno.env.get("UPLOAD_POST_API_KEY");

  if (!uploadPostApiKey) {
    return new Response(
      JSON.stringify({ error: "UPLOAD_POST_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { publicationId } = await req.json();
    if (!publicationId) throw new Error("publicationId is required");

    // Fetch publication with video and channel
    const { data: pub, error: pubErr } = await supabase
      .from("publications")
      .select("*, video:videos(*), channel:publishing_channels(*)")
      .eq("id", publicationId)
      .single();

    if (pubErr || !pub) throw new Error(`Publication not found: ${pubErr?.message}`);

    const video = pub.video;
    const channel = pub.channel;

    if (!channel?.upload_post_user) {
      throw new Error("Channel has no upload_post_user configured");
    }

    // Determine video URL
    const videoUrl = pub.final_video_url || video?.video_path || video?.heygen_video_url;
    if (!videoUrl) throw new Error("No video URL available");

    // Map network_type to Upload-Post platform
    const platformMap: Record<string, string> = {
      instagram: "instagram",
      tiktok: "tiktok",
      youtube: "youtube",
      facebook: "facebook",
    };

    const platform = platformMap[channel.network_type];
    if (!platform) {
      throw new Error(`Unsupported network_type for Upload-Post: ${channel.network_type}`);
    }

    // Build form data
    const formData = new FormData();
    formData.append("user", channel.upload_post_user);
    formData.append("platform[]", platform);
    formData.append("video", videoUrl);
    formData.append("async_upload", "true");

    if (pub.generated_text) {
      formData.append("title", pub.generated_text);
    }

    // For YouTube, also send description
    if (platform === "youtube" && pub.generated_text) {
      formData.append("description", pub.generated_text);
    }

    // Cover/thumbnail
    if (video?.front_cover_url) {
      if (platform === "instagram") {
        formData.append("cover_url", video.front_cover_url);
      }
      if (platform === "youtube") {
        formData.append("thumbnail_url", video.front_cover_url);
      }
    }

    console.log(`Publishing to ${platform} via Upload-Post for publication ${publicationId}`);

    const response = await fetch("https://api.upload-post.com/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Apikey ${uploadPostApiKey}`,
      },
      body: formData,
    });

    const result = await response.json();
    console.log("Upload-Post response:", JSON.stringify(result));

    if (!response.ok) {
      throw new Error(`Upload-Post API error ${response.status}: ${JSON.stringify(result)}`);
    }

    if (result.success) {
      // Async upload - store request_id
      const updateData: Record<string, unknown> = {
        publication_status: "published",
        updated_at: new Date().toISOString(),
      };

      if (result.request_id) {
        updateData.post_url = `upload-post:${result.request_id}`;
      }

      // If sync response has direct URL
      if (result.results?.[platform]?.url) {
        updateData.post_url = result.results[platform].url;
      }

      await supabase
        .from("publications")
        .update(updateData)
        .eq("id", publicationId);
    } else {
      throw new Error(`Upload-Post returned success=false: ${JSON.stringify(result)}`);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "publication",
      entity_id: publicationId,
      parent_entity_id: video?.id,
      action: "publish_social",
      details: { platform, user: channel.upload_post_user, request_id: result.request_id },
    });

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("publish-to-social error:", error);

    // Try to update publication status to error
    try {
      const { publicationId } = await req.clone().json().catch(() => ({}));
      if (publicationId) {
        await supabase
          .from("publications")
          .update({
            publication_status: "error",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", publicationId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
