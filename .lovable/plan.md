

## Problem

When user selects a new scene variant (different image), `selectVariant` in `usePlaylistScenes.ts` updates `scene_url` but **does NOT clear `motion_avatar_id`**. The old motion avatar (trained on the previous image) persists and gets used for video generation — wrong face/pose.

The `generate-video-heygen` edge function correctly reads scene data, but it trusts whatever `motion_avatar_id` is stored on the scene record.

## Fix

### `src/hooks/usePlaylistScenes.ts` — `selectVariant` function

When the scene URL changes (new variant selected), clear motion fields so stale motion trained on the old image isn't reused:

```typescript
// Update scene_url AND clear stale motion on the main scene record
await supabase
  .from('playlist_scenes')
  .update({ 
    scene_url: (variant as SceneVariant).image_url,
    motion_avatar_id: null,
    motion_type: null,
    motion_prompt: null,
  })
  .eq('id', sceneId);
```

This ensures:
1. New scene variant → motion is cleared → user must re-add motion for the new image ($1 cost)
2. `generate-video-heygen` sees `motion_avatar_id = null` → uploads fresh talking photo from the new scene image
3. If auto-motion is enabled, it will auto-generate motion for the new image (not reuse old)

### No other files need changes
The edge function already handles `null` motion correctly (falls back to fresh upload). The SceneSidePanel's reset/add motion UI already works independently.

