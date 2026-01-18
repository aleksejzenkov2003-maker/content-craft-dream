import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const elevenlabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!elevenlabsKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    console.log('Fetching ElevenLabs voices...');

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('ElevenLabs voices response:', JSON.stringify(result).slice(0, 500));

    // Extract voices from response
    const voices = result.voices || [];
    
    // Format voices for frontend
    const formattedVoices = voices.map((voice: {
      voice_id: string;
      name: string;
      category?: string;
      labels?: Record<string, string>;
      preview_url?: string;
    }) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category || 'custom',
      labels: voice.labels || {},
      preview_url: voice.preview_url || null,
    }));

    console.log(`Found ${formattedVoices.length} voices`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        voices: formattedVoices 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Get voices error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
