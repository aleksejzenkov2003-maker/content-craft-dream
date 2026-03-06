import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicationId } = await req.json();

    if (!publicationId) {
      return new Response(
        JSON.stringify({ error: "publicationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch publication with related data
    const { data: publication, error: pubError } = await supabase
      .from("publications")
      .select(`
        *,
        video:videos (
          id,
          video_title,
          question,
          hook,
          advisor_answer,
          advisor:advisors (id, name, display_name)
        ),
        channel:publishing_channels (id, name, network_type, post_text_prompt, prompt_id)
      `)
      .eq("id", publicationId)
      .single();

    if (pubError || !publication) {
      return new Response(
        JSON.stringify({ error: "Publication not found", details: pubError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve prompt: priority is prompt_id → post_text_prompt → DB fallback → hardcoded
    let systemPrompt = "";
    let userTemplate = "";

    const channelPromptId = publication.channel?.prompt_id;
    const channelRawPrompt = publication.channel?.post_text_prompt;

    if (channelPromptId) {
      // Use linked prompt from prompts table
      const { data: linkedPrompt } = await supabase
        .from("prompts")
        .select("system_prompt, user_template")
        .eq("id", channelPromptId)
        .single();

      if (linkedPrompt) {
        systemPrompt = linkedPrompt.system_prompt;
        userTemplate = linkedPrompt.user_template;
      }
    }

    if (!userTemplate && channelRawPrompt) {
      // Fallback to raw text on channel
      userTemplate = channelRawPrompt;
    }

    if (!userTemplate) {
      // Fallback to active post_text prompt in DB
      const { data: dbPrompt } = await supabase
        .from("prompts")
        .select("system_prompt, user_template")
        .eq("type", "post_text")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (dbPrompt) {
        systemPrompt = dbPrompt.system_prompt;
        userTemplate = dbPrompt.user_template;
      }
    }

    if (!userTemplate) {
      userTemplate = `Создай привлекательный текст для публикации в социальных сетях на основе следующей информации:
- Вопрос: {{question}}
- Хук: {{hook}}
- Ответ духовника: {{answer}}
- Духовник: {{advisor}}

Текст должен быть кратким (до 280 символов), содержать эмодзи и призыв к действию.`;
    }

    // Prepare context for prompt
    const advisorName = publication.video?.advisor?.display_name || 
                       publication.video?.advisor?.name || 
                       "Духовник";
    
    const question = publication.video?.question || "";
    const hook = publication.video?.hook || "";
    const answer = publication.video?.advisor_answer || "";
    const videoTitle = publication.video?.video_title || "";
    const channelName = publication.channel?.name || "";
    const networkType = publication.channel?.network_type || "";

    // Replace placeholders in user template
    const prompt = userTemplate
      .replace(/{{question}}/g, question)
      .replace(/{{hook}}/g, hook)
      .replace(/{{answer}}/g, answer)
      .replace(/{{advisor}}/g, advisorName)
      .replace(/{{video_title}}/g, videoTitle)
      .replace(/{{channel}}/g, channelName)
      .replace(/{{network_type}}/g, networkType);

    let generatedText = "";

    if (anthropicKey) {
      const messages: Array<{ role: string; content: string }> = [];
      
      if (systemPrompt) {
        messages.push({ role: "user", content: prompt });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", errorText);
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const result = await response.json();
      generatedText = result.content[0]?.text || "";
    } else {
      // Fallback: generate simple text without AI
      generatedText = `🙏 ${question}\n\n${hook}\n\n📺 Смотрите ответ ${advisorName}!\n\n#духовник #вопрос #ответ`;
    }

    // Update publication with generated text
    const { error: updateError } = await supabase
      .from("publications")
      .update({ generated_text: generatedText })
      .eq("id", publicationId);

    if (updateError) {
      console.error("Failed to update publication:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated_text: generatedText 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-post-text:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
