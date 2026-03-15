

## Problems Identified

1. **Scene not loading**: The edge function queries `playlist_scenes` with `.eq('review_status', 'approved')`, but scenes use `status = 'approved'` for approval. The `review_status` column still says `'Waiting'`. This means NO scene is ever found.

2. **Stale motion ID**: Because the scene isn't found, `sceneMotionAvatarId` is null, so the code falls back to `video.motion_avatar_id` which contains the old broken ID `a225653a...` instead of the new working one `119fc911...` from the scene.

## Fix (1 file)

### `supabase/functions/generate-video-heygen/index.ts`

**Change 1**: Fix the scene lookup query — use `status` column instead of (or in addition to) `review_status`:

```typescript
// Current (broken):
.eq('review_status', 'approved')

// Fixed — check status column:
.eq('status', 'approved')
```

**Change 2**: When a scene IS found, clear stale `motion_avatar_id` from the video record if it differs from the scene's motion ID. This prevents the video's old motion from being reused after a scene update:

```typescript
// After scene is found, clear stale video motion if scene has different one
if (sceneMotionAvatarId && video.motion_avatar_id && video.motion_avatar_id !== sceneMotionAvatarId) {
  await supabase.from('videos').update({ 
    motion_avatar_id: sceneMotionAvatarId 
  }).eq('id', videoId);
}
```

**Change 3**: Do NOT fall back to `video.motion_avatar_id` when a scene exists. The scene's motion should always take priority. If the scene has no motion but the video has a stale one, ignore the stale one when a scene is present:

```typescript
// Current:
let effectiveMotionAvatarId = motionEnabled ? (sceneMotionAvatarId || video.motion_avatar_id) : null;

// Fixed — only use video.motion_avatar_id if no scene was found at all:
let effectiveMotionAvatarId = motionEnabled 
  ? (sceneMotionAvatarId || (sceneUrl ? null : video.motion_avatar_id)) 
  : null;
```

These three changes ensure: the correct scene is found, its motion ID is used, and stale video-level motion IDs don't override scene data.

