

## Problem: Race Condition on Re-generation

When re-generating a video, the following sequence causes chaos:

1. `handleFullVideoPipeline` clears `heygen_video_url`, `video_path`, etc. but **does NOT clear `heygen_video_id`**
2. Sets `generation_status: 'generating'` → auto-polling useEffect (line 357) sees this and starts polling
3. `check-video-status` edge function reads the **OLD** `heygen_video_id` from DB (the new one hasn't been set yet by `generate-video-heygen`)
4. The old HeyGen video is already "completed" on HeyGen's side → edge function immediately returns `status: 'ready'` and sets `heygen_video_url` to the OLD video URL
5. Polling sees "ready" → triggers `postProcessVideo` with the old video → flood of toasts and wrong video processing
6. Meanwhile, `generate-video-heygen` eventually sets the NEW `heygen_video_id`, but it's too late

Additionally, the **auto-resume** logic (line 289) can fire incorrectly during re-generation if stale `reel_status === 'generating'` persists from a previous run.

## Fix

### 1. Clear `heygen_video_id` on re-generation (`Index.tsx`)

In both `handleGenerateVideo` and `handleFullVideoPipeline`, add `heygen_video_id: null` to the artifact reset. This prevents the old HeyGen ID from being checked before the new one is set.

```typescript
// Lines ~385 and ~441
heygen_video_id: null,  // ← ADD THIS
heygen_video_url: null,
video_path: null,
reduced_video_url: null,
reel_status: null,
```

### 2. Guard auto-resume against active generation (`Index.tsx`)

Add `generation_status !== 'generating'` to the auto-resume filter (line 289) so it doesn't fire during an active re-generation cycle:

```typescript
const stuckVideos = videos.filter(
  v => v.reel_status === 'generating' 
    && v.generation_status !== 'generating'  // ← ADD THIS
    && v.heygen_video_url 
    && !resumedRef.current.has(v.id)
);
```

### 3. Guard polling from premature "ready" (`Index.tsx`)

In `pollVideoStatus`, after receiving `status === 'ready'`, verify the video actually has a fresh `heygen_video_url` before triggering post-processing. The `check-video-status` edge function already sets `heygen_video_url` in DB, so refetch first and verify.

### Files to change
- **`src/pages/Index.tsx`**: 3 small edits (clear heygen_video_id, guard auto-resume, guard polling)

