import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  photoId: string;
  photoUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photoId, photoUrl } = await req.json() as UploadRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const heygenKey = Deno.env.get('HEYGEN_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Uploading photo ${photoId} to HeyGen from URL: ${photoUrl}`);

    // Download the image
    const imageResponse = await fetch(photoUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();

    // Upload to HeyGen using the correct upload endpoint: https://upload.heygen.com/v1/asset
    // This matches the n8n workflow which sends binary data to this endpoint
    const heygenResponse = await fetch('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenKey,
        'Content-Type': imageBlob.type || 'image/png',
      },
      body: imageBlob,
    });

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error('HeyGen upload error:', errorText);
      throw new Error(`HeyGen API error: ${heygenResponse.status} - ${errorText}`);
    }

    const result = await heygenResponse.json();
    console.log('HeyGen upload result:', JSON.stringify(result));

    // Extract image_key from response — this is what's used for video generation
    const imageKey = result.data?.image_key;
    const assetId = result.data?.id || imageKey;
    
    if (!assetId) {
      throw new Error('No asset ID returned from HeyGen');
    }

    // Update photo record with HeyGen asset ID (store image_key for video generation)
    // Scene photos have IDs like "scene-<uuid>" — update playlist_scenes instead
    if (photoId.startsWith('scene-')) {
      const sceneId = photoId.replace('scene-', '');
      console.log(`Updating playlist_scene ${sceneId} with heygen asset info`);
      // No heygen_asset_id column on playlist_scenes, so we just skip the DB update
    } else {
      const { error: updateError } = await supabase
        .from('advisor_photos')
        .update({ heygen_asset_id: imageKey || assetId })
        .eq('id', photoId);

      if (updateError) {
        console.error('Failed to update photo record:', updateError);
        throw updateError;
      }
    }

    console.log(`Photo ${photoId} uploaded to HeyGen with image_key: ${imageKey}, asset_id: ${assetId}`);

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'heygen_photo_uploaded',
      entity_type: 'advisor_photo',
      entity_id: photoId,
      details: { heygen_asset_id: assetId, image_key: imageKey },
    });

    return new Response(
      JSON.stringify({ success: true, assetId, imageKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
