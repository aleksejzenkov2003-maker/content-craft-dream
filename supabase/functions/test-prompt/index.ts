import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_TYPES = ['atmosphere', 'scene'];

interface TestPromptRequest {
  systemPrompt: string;
  userTemplate: string;
  testContent: string;
  type?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  advisorPhotoUrl?: string;
}

async function handleTextPrompt(
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number,
  maxTokens: number
) {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (response.status === 401) throw new Error('Invalid API key. Please check ANTHROPIC_API_KEY.');
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return { result: result.content[0].text, usage: result.usage };
}

async function handleImagePromptLovable(
  userMessage: string,
  model: string,
  advisorPhotoUrl?: string
) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) throw new Error('LOVABLE_API_KEY is not configured');

  // Build content: if advisor photo provided, use multimodal (text + image)
  let content: any;
  if (advisorPhotoUrl) {
    content = [
      { type: 'text', text: userMessage },
      { type: 'image_url', image_url: { url: advisorPhotoUrl } }
    ];
  } else {
    content = userMessage;
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (response.status === 402) throw new Error('Payment required. Please add credits.');
    throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const textContent = result.choices?.[0]?.message?.content || '';

  if (imageUrl) {
    return { result: imageUrl, text: textContent };
  }
  return { result: textContent };
}

async function handleImagePromptKie(userMessage: string) {
  const kieApiKey = Deno.env.get('KIE_API_KEY');
  if (!kieApiKey) throw new Error('KIE_API_KEY is not configured');

  // Create task
  const createRes = await fetch('https://api.kie.ai/api/v1/task/create/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${kieApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: userMessage,
      model: 'google/nano-banana',
      aspectRatio: '9:16',
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Kie.ai error: ${createRes.status} - ${err}`);
  }

  const createData = await createRes.json();
  const taskId = createData.data?.id;
  if (!taskId) throw new Error('No task ID from Kie.ai');

  // Poll for result
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.kie.ai/api/v1/task/${taskId}`, {
      headers: { 'Authorization': `Bearer ${kieApiKey}` }
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    
    if (status === 'completed') {
      const imageUrl = statusData.data?.output?.image_url;
      if (imageUrl) return { result: imageUrl };
      throw new Error('No image URL in Kie.ai result');
    }
    if (status === 'failed') throw new Error('Kie.ai task failed');
  }
  throw new Error('Kie.ai task timed out');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      systemPrompt, 
      userTemplate, 
      testContent,
      type = 'rewrite',
      model = 'claude-sonnet-4-5',
      temperature = 0.7,
      maxTokens = 4000,
      advisorPhotoUrl
    } = await req.json() as TestPromptRequest;

    const userMessage = userTemplate
      .replace(/\{\{content\}\}/g, testContent)
      .replace(/\{\{title\}\}/g, testContent.substring(0, 100))
      .replace(/\{\{source\}\}/g, 'test')
      .replace(/\{\{channel\}\}/g, 'test')
      .replace(/\{\{question\}\}/g, testContent)
      .replace(/\{\{hook\}\}/g, testContent.substring(0, 50))
      .replace(/\{\{answer\}\}/g, testContent)
      .replace(/\{\{advisor\}\}/g, 'Test Advisor')
      .replace(/\{\{playlist\}\}/g, 'Test Playlist');

    const isImage = IMAGE_TYPES.includes(type);
    console.log(`Testing prompt: type=${type}, model=${model}, isImage=${isImage}, hasAdvisorPhoto=${!!advisorPhotoUrl}`);

    let data;
    if (isImage) {
      let fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userMessage}` : userMessage;
      
      if (advisorPhotoUrl) {
        fullPrompt += '\n\nИспользуй предоставленное фото человека и органично встрой его в сгенерированную сцену. Человек должен выглядеть естественно в контексте сцены.';
      }
      
      if (model === 'nano-banana-pro') {
        data = await handleImagePromptKie(fullPrompt);
      } else {
        data = await handleImagePromptLovable(fullPrompt, model, advisorPhotoUrl);
      }
    } else {
      data = await handleTextPrompt(systemPrompt, userMessage, model, temperature, maxTokens);
    }

    return new Response(
      JSON.stringify({ success: true, ...data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Test prompt error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
