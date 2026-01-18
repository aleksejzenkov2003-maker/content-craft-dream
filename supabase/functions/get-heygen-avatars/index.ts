import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CachedAvatar {
  id: string;
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string | null;
  preview_video_url: string | null;
  cached_at: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} of ${retries}...`);
      const response = await fetchWithTimeout(url, options, 45000);
      
      if (response.status >= 500 && response.status < 600) {
        console.log(`Server error ${response.status}, will retry...`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${i + 1} failed: ${lastError.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('HeyGen API временно недоступен');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for force refresh parameter
    let forceRefresh = false;
    try {
      const body = await req.json();
      forceRefresh = body?.forceRefresh === true;
    } catch {
      // No body or invalid JSON - that's fine
    }

    // Check cache first (valid for 24 hours)
    const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
    const { data: cachedAvatars, error: cacheError } = await supabase
      .from('heygen_avatars')
      .select('*')
      .eq('is_active', true)
      .order('avatar_name');

    if (!forceRefresh && !cacheError && cachedAvatars && cachedAvatars.length > 0) {
      // Check if cache is still valid
      const oldestCache = cachedAvatars.reduce((oldest: CachedAvatar, avatar: CachedAvatar) => {
        return new Date(avatar.cached_at) < new Date(oldest.cached_at) ? avatar : oldest;
      }, cachedAvatars[0]);
      
      const cacheAge = Date.now() - new Date(oldestCache.cached_at).getTime();
      
      if (cacheAge < cacheMaxAge) {
        console.log(`Returning ${cachedAvatars.length} avatars from cache (age: ${Math.round(cacheAge / 60000)} min)`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            avatars: cachedAvatars.map((a: CachedAvatar) => ({
              avatar_id: a.avatar_id,
              avatar_name: a.avatar_name,
              preview_image_url: a.preview_image_url,
              preview_video_url: a.preview_video_url
            })),
            fromCache: true,
            cachedAt: oldestCache.cached_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch from HeyGen API
    const heygenKey = Deno.env.get('HEYGEN_API_KEY');
    
    if (!heygenKey) {
      // If no API key but we have cache, return cache
      if (cachedAvatars && cachedAvatars.length > 0) {
        console.log('No API key, returning cached avatars');
        return new Response(
          JSON.stringify({ 
            success: true, 
            avatars: cachedAvatars.map((a: CachedAvatar) => ({
              avatar_id: a.avatar_id,
              avatar_name: a.avatar_name,
              preview_image_url: a.preview_image_url,
              preview_video_url: a.preview_video_url
            })),
            fromCache: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('HEYGEN_API_KEY not configured');
    }

    console.log('Fetching avatars from HeyGen API...');

    let response: Response;
    try {
      response = await fetchWithRetry('https://api.heygen.com/v2/avatars', {
        method: 'GET',
        headers: {
          'X-Api-Key': heygenKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (apiError) {
      // API failed - return cache if available
      if (cachedAvatars && cachedAvatars.length > 0) {
        console.log('API failed, returning cached avatars:', apiError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            avatars: cachedAvatars.map((a: CachedAvatar) => ({
              avatar_id: a.avatar_id,
              avatar_name: a.avatar_name,
              preview_image_url: a.preview_image_url,
              preview_video_url: a.preview_video_url
            })),
            fromCache: true,
            apiError: 'HeyGen API временно недоступен'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw apiError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen API error:', response.status, errorText);
      
      // On API error, return cache if available
      if (cachedAvatars && cachedAvatars.length > 0) {
        console.log('API error, returning cached avatars');
        return new Response(
          JSON.stringify({ 
            success: true, 
            avatars: cachedAvatars.map((a: CachedAvatar) => ({
              avatar_id: a.avatar_id,
              avatar_name: a.avatar_name,
              preview_image_url: a.preview_image_url,
              preview_video_url: a.preview_video_url
            })),
            fromCache: true,
            apiError: `HeyGen API error: ${response.status}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const responseText = await response.text();
    console.log(`Response received, length: ${responseText.length} chars`);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText.slice(0, 500));
      throw new Error('Failed to parse HeyGen response');
    }

    const avatars = result.data?.avatars || [];
    
    // Format and deduplicate avatars
    const seenIds = new Set<string>();
    const formattedAvatars = avatars
      .filter((avatar: { avatar_id: string }) => {
        if (seenIds.has(avatar.avatar_id)) return false;
        seenIds.add(avatar.avatar_id);
        return true;
      })
      .map((avatar: {
        avatar_id: string;
        avatar_name?: string;
        preview_image_url?: string;
        preview_video_url?: string;
      }) => ({
        avatar_id: avatar.avatar_id,
        avatar_name: avatar.avatar_name || avatar.avatar_id,
        preview_image_url: avatar.preview_image_url || null,
        preview_video_url: avatar.preview_video_url || null,
      }));

    console.log(`Found ${formattedAvatars.length} unique avatars, updating cache...`);

    // Update cache in database
    const now = new Date().toISOString();
    
    // Upsert avatars into cache
    for (const avatar of formattedAvatars) {
      const { error: upsertError } = await supabase
        .from('heygen_avatars')
        .upsert({
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          cached_at: now,
          is_active: true
        }, { onConflict: 'avatar_id' });
      
      if (upsertError) {
        console.error('Cache upsert error for', avatar.avatar_id, upsertError);
      }
    }

    // Mark avatars not in API response as inactive
    const activeIds = formattedAvatars.map((a: { avatar_id: string }) => a.avatar_id);
    if (activeIds.length > 0) {
      await supabase
        .from('heygen_avatars')
        .update({ is_active: false })
        .not('avatar_id', 'in', `(${activeIds.join(',')})`);
    }

    console.log('Cache updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        avatars: formattedAvatars,
        fromCache: false,
        cachedAt: now
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Get avatars error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
