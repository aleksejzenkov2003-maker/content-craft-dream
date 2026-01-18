import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RewriteRequest {
  contentId: string;
  promptId?: string;
}

// Clean markdown formatting from text
function cleanMarkdown(text: string): string {
  return text
    // Remove bold markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic markers
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points
    .replace(/^[-*•]\s+/gm, '')
    // Remove numbered lists but keep content
    .replace(/^\d+\.\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove inline links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputData: Record<string, unknown> = {};
  let outputData: Record<string, unknown> = {};

  try {
    const { contentId, promptId } = await req.json() as RewriteRequest;
    inputData = { contentId, promptId };
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the content to rewrite
    const { data: content, error: contentError } = await supabase
      .from('parsed_content')
      .select('*, channels(name, source)')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error('Content not found');
    }

    inputData.contentTitle = content.title;
    inputData.contentLength = content.content?.length || 0;

    // Get the prompt
    let prompt;
    if (promptId) {
      const { data: p } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .single();
      prompt = p;
    } else {
      const { data: p } = await supabase
        .from('prompts')
        .select('*')
        .eq('is_active', true)
        .eq('type', 'rewrite')
        .limit(1)
        .single();
      prompt = p;
    }

    if (!prompt) {
      throw new Error('No active prompt found');
    }

    // Use model from prompt or default to claude-sonnet-4-5
    const model = prompt.model || 'claude-sonnet-4-5';
    
    inputData.promptName = prompt.name;
    inputData.model = model;

    console.log(`Rewriting content ${contentId} with prompt ${prompt.id}, model: ${model}`);

    // Update status to rewriting
    await supabase
      .from('parsed_content')
      .update({ status: 'rewriting' })
      .eq('id', contentId);

    // Add instruction to avoid markdown AND to stay on topic
    const systemPromptWithNoMarkdown = prompt.system_prompt + 
      '\n\nВАЖНО: Не используй markdown форматирование. Никаких звездочек (*), решеток (#), подчеркиваний (_) или других символов разметки. Только чистый текст без форматирования.' +
      '\n\nКРИТИЧЕСКИ ВАЖНО: Пиши СТРОГО на тему исходного контента. Не отклоняйся от темы источника. Полностью сохраняй тематику и ключевые идеи оригинала. НЕ меняй тему статьи, не придумывай новые темы.';

    // Prepare the user message with explicit topic header
    const userMessage = `ТЕМА СТАТЬИ: ${content.title}\n\nИСХОДНЫЙ КОНТЕНТ:\n${content.content || content.title}\n\n` + 
      prompt.user_template
        .replace(/\{\{content\}\}/g, content.content || content.title)
        .replace(/\{\{title\}\}/g, content.title)
        .replace(/\{\{source\}\}/g, content.channels?.source || 'unknown')
        .replace(/\{\{channel\}\}/g, content.channels?.name || 'unknown');

    inputData.userMessageLength = userMessage.length;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: prompt.max_tokens || 4000,
        system: systemPromptWithNoMarkdown,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check ANTHROPIC_API_KEY.');
      }
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const rawText = result.content[0].text;
    
    // Clean markdown formatting from the response
    const rewrittenText = cleanMarkdown(rawText);

    // Calculate tokens
    const inputTokens = result.usage?.input_tokens || 0;
    const outputTokens = result.usage?.output_tokens || 0;
    const tokensUsed = inputTokens + outputTokens;
    
    outputData.tokensUsed = tokensUsed;
    outputData.inputTokens = inputTokens;
    outputData.outputTokens = outputTokens;
    outputData.outputLength = rewrittenText.length;

    // Parse the response to extract hook, content, and CTA
    const hookMatch = rewrittenText.match(/(?:HOOK|ХУК|КРЮЧОК)[:\s]*(.+?)(?=ОСНОВНОЙ|СКРИПТ|$)/is);
    const ctaMatch = rewrittenText.match(/(?:CTA|ПРИЗЫВ)[:\s]*(.+?)$/is);

    // Clean hook and CTA from markdown too
    const hook = hookMatch ? cleanMarkdown(hookMatch[1].trim()) : null;
    const cta = ctaMatch ? cleanMarkdown(ctaMatch[1].trim()) : null;

    // Save rewritten content
    const { data: rewritten, error: insertError } = await supabase
      .from('rewritten_content')
      .insert({
        parsed_content_id: contentId,
        prompt_id: prompt.id,
        rewritten_text: rewrittenText,
        script: rewrittenText,
        hook: hook,
        cta: cta
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update content status
    await supabase
      .from('parsed_content')
      .update({ status: 'rewritten' })
      .eq('id', contentId);

    outputData.rewrittenId = rewritten.id;
    outputData.hookFound = !!hookMatch;
    outputData.ctaFound = !!ctaMatch;

    const durationMs = Date.now() - startTime;

    // Log activity with detailed input/output
    await supabase.from('activity_log').insert({
      action: 'rewrite_complete',
      entity_type: 'parsed_content',
      entity_id: contentId,
      details: { rewritten_id: rewritten.id, model: model, provider: 'anthropic' },
      input_data: inputData,
      output_data: outputData,
      duration_ms: durationMs,
      tokens_used: tokensUsed,
      cost_estimate: (inputTokens * 0.000003) + (outputTokens * 0.000015) // Claude Sonnet pricing
    });

    console.log('Rewrite complete:', rewritten.id, `(${durationMs}ms, ${tokensUsed} tokens)`);

    return new Response(
      JSON.stringify({ success: true, data: rewritten }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Rewrite error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    // Log error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('activity_log').insert({
        action: 'rewrite_error',
        entity_type: 'parsed_content',
        entity_id: inputData.contentId as string || null,
        details: { error: errorMessage },
        input_data: inputData,
        output_data: { error: errorMessage },
        duration_ms: durationMs
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
