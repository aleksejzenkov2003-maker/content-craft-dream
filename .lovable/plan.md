

## Problem

HeyGen's `add_motion` API creates motion avatars **asynchronously**. Even after 75 seconds of retries inside `generate-video-heygen`, HeyGen hasn't finished processing the avatar. The edge function was designed to create motion and use it in the same call — this is fundamentally flawed because HeyGen needs **minutes**, not seconds.

The manual flow worked because there was a natural time gap between creating motion (clicking a button) and generating a video (clicking another button later). We need to replicate this gap in the automated flow.

## Solution: Pre-create motion BEFORE video generation

Separate motion creation from video generation by making it an early pipeline step that runs in parallel with voiceover/atmosphere generation. By the time video generation starts, the motion avatar will already be processed.

```text
Current (broken):
  generate-video-heygen: create_motion → wait 75s → still fails → static fallback

Fixed:
  triggerAutoGeneration:   create_motion (async, early)
  handleFullVideoPipeline: create_motion if missing (before voiceover)
  generate-video-heygen:   use existing motion_avatar_id → try once → fallback if not ready
```

## Changes

### 1. `src/pages/Index.tsx` — Add motion pre-warm step

**In `triggerAutoGeneration`** (line ~802, after voiceover step):
- Add a new step: if `motion_enabled` setting is true and the video has a `playlist_id`/`advisor_id`, check if the corresponding scene has a `motion_avatar_id`. If not, call `add-avatar-motion` edge function to pre-create it. This runs in parallel with voiceover and atmosphere generation.

**In `handleFullVideoPipeline`** (line ~476, before HeyGen call):
- Add a motion pre-creation check: if motion is enabled and scene lacks `motion_avatar_id`, call `add-avatar-motion` and wait for it. Then proceed with video generation. The voiceover generation (Step 1) already provides a natural delay of 10-30 seconds.

### 2. `supabase/functions/generate-video-heygen/index.ts` — Simplify motion usage

- **Remove the auto-creation block** (lines 243-335). Motion is now pre-created by the client pipeline.
- **Remove the 5x retry loop** (lines 368-430). Replace with a single attempt: try using `motion_avatar_id` once. If "missing image dimensions", fall back to static immediately.
- Keep the motion_avatar_id in the DB for future reuse.
- This dramatically reduces function execution time (from ~90s to ~5s for the motion part).

### 3. Result

- Motion is created **minutes before** video generation (alongside voiceover/atmosphere)
- No more timeouts or "provider didn't process in time" warnings
- If motion is still not ready (rare), graceful single fallback to static, preserving the ID for next run
- Edge function runs faster and never hits timeout limits

