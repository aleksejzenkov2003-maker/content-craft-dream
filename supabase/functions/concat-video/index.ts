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
    const { publication_id, video_url, back_cover_video_url } = await req.json();

    if (!publication_id || !video_url || !back_cover_video_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: publication_id, video_url, back_cover_video_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ error: "N8N_WEBHOOK_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update publication status to concatenating
    await supabase
      .from("publications")
      .update({ publication_status: "concatenating" })
      .eq("id", publication_id);

    // Call n8n webhook for ffmpeg concatenation
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "concat_video",
        publication_id,
        main_video_url: video_url,
        back_cover_video_url,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      await supabase
        .from("publications")
        .update({
          publication_status: "error",
          error_message: `n8n concat error: ${errorText}`,
        })
        .eq("id", publication_id);

      return new Response(
        JSON.stringify({ error: "n8n webhook failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await n8nResponse.json();

    // If n8n returns the final video URL directly
    if (result.final_video_url) {
      await supabase
        .from("publications")
        .update({
          final_video_url: result.final_video_url,
          publication_status: "checked",
        })
        .eq("id", publication_id);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("concat-video error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
