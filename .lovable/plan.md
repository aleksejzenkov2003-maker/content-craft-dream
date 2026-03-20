

## Analysis

### Problem 1: Motion not applied
The activity log shows a clear pattern:
1. `auto_motion_created` at 13:45:30 — motion avatar ID `72187d843f994433a6fc01f46f2877f1` created successfully (6s)
2. `heygen_video_started` at 13:45:39 (9s later) — motion NOT used, warning: "провайдер не успел обработать аватар"

**Root cause**: The motion avatar is created successfully, but when HeyGen's video generation API tries to use it, it fails with "missing image dimensions" because HeyGen hasn't finished processing the avatar internally. The current 10-second wait is insufficient. Additionally, the retry logic clears the motion_avatar_id from the database, destroying it for future reuse.

The scene (`playlist_scenes`) has no `scene_url` (null, status=waiting), so no pre-existing motion is reused. Every generation creates a fresh motion avatar and loses it.

### Problem 2: Subtitles not burned
- `subtitles` is enabled in automation settings
- `word_timestamps` exist
- `reduced_video_url` exists and equals `video_path` — meaning resize ran but subtitles didn't burn
- `reel_status: ready` but `generation_status: generating` — stuck state
- The `fontSize` in `postProcessVideo` (Index.tsx line 249) is still `48`, not `72` as previously requested

The subtitle burn likely failed silently in the browser (possibly CORS or FFmpeg loading issue), and the catch block set `reel_status: error` but then line 272 overwrote it with `ready`. Need to check logic flow more carefully — actually looking at lines 261-266, the catch sets `reel_status: error` but does NOT `return`, so execution continues to line 272 which sets `reel_status: ready`. This is a bug.

### Problem 3: generation_status stuck at 'generating'
The second generation (heygen_video_id `c0d55a56f47f4542821f8885faecff8e`) was started but its polling/status check may have been lost (page was navigated away, or the first generation's polling interfered). The `check-video-status` function updates `generation_status` to `ready` only when HeyGen returns `completed`. Post-processing then sets `generation_status: ready` at line 272. But if post-processing ran with the OLD heygen_video_url (from first generation), it would succeed but not update `generation_status` from the new generation.

## Plan

### 1. Fix motion reliability in `generate-video-heygen` edge function
- **Increase wait time** from 10s to 20s after motion creation
- **Add polling** instead of blind wait: check if the avatar is ready by attempting a lightweight HeyGen API call (or simply retry the video generation up to 2 times with delays)
- **Do NOT clear motion_avatar_id on "missing image dimensions"** — keep it in the DB for future reuse since it will eventually become available. Only clear if the motion creation itself failed.
- When the video generation fails due to unprocessed motion, fall back to static photo for THIS generation but preserve the motion_avatar_id

### 2. Fix subtitle burn error handling in `Index.tsx`
- In `postProcessVideo`, after the subtitle catch block sets `reel_status: error`, add a `return` so execution doesn't continue to line 272 which overwrites the error with `ready`
- Update subtitle `fontSize` from `48` to `72` to match the user's request

### 3. Fix generation_status stuck state
- In `postProcessVideo`, ensure `generation_status` is always set to `ready` upon successful completion (already done at line 272, but the subtitle error path bypasses it incorrectly)
- The auto-resume logic (line 297-298) checks `generation_status !== 'generating'` — so if generation_status is stuck, post-processing never auto-resumes. Fix by also checking if `heygen_video_url` exists as an override condition.

### Files to change

1. **`supabase/functions/generate-video-heygen/index.ts`**
   - Increase motion wait from 10s to 20s
   - On "missing image dimensions" retry: do NOT clear motion_avatar_id from DB, just skip motion for current generation
   - Add a second retry with 10s delay before falling back to static

2. **`src/pages/Index.tsx`**
   - Line 249: Change `fontSize: 48` → `fontSize: 72`
   - Lines 261-266: After subtitle burn fails and sets `reel_status: error`, still continue to save `video_path` with reduced (non-subtitled) video but keep error status. Currently the code falls through to line 272 which overwrites the error.
   - Line 297-298: Fix auto-resume condition to also handle `generation_status === 'generating'` when `heygen_video_url` exists

3. **Deploy** the updated edge function

