

## Problem Analysis

The "Аватар на фоновой подложке" (background_overlay) video format mode has two critical issues:

1. **No overlay compositing step**: The backend correctly selects the transparent avatar photo and finds the background video URL, but after HeyGen generates the avatar video, there is **no FFmpeg step** that overlays the avatar onto the background video. The pipeline goes straight to bitrate reduction → subtitles, producing a video of just the avatar on whatever background HeyGen used (the original photo).

2. **No validation/popup**: When prerequisites are missing (no `avatar_photo_id` on the advisor, no background video assigned for the playlist+advisor pair), the system silently falls back to `full_photo` behavior instead of warning the user.

## Solution

### 1. Frontend validation popup before generation

**Files: `src/pages/Index.tsx`**

Before launching `generate-video-heygen` in both `handleGenerateVideo` and `handleFullVideoPipeline`:
- Check `app_settings` for `video_format_mode === 'background_overlay'`
- If overlay mode, verify prerequisites for the video's advisor+playlist:
  - Advisor has `avatar_photo_id` set
  - A `background_assignment` exists for this playlist+advisor pair
- If anything is missing, show a toast.error popup explaining what's missing (e.g. "Для режима «Фоновая подложка» нужно: назначить аватар-фото духовнику / назначить подложку для пары плейлист+духовник") and **abort** generation

Extract this into a helper function `validateOverlayPrerequisites(video)` that returns `{ ok: boolean; missing: string[] }`.

### 2. Backend: pass green_screen option to HeyGen API

**File: `supabase/functions/generate-video-heygen/index.ts`**

When `isOverlayMode` is true, add `background: { type: "green_screen" }` (or equivalent HeyGen parameter) to the video generation request body so HeyGen outputs a green-screen/transparent-background video instead of using the photo as background.

Update `buildHeygenBody` to accept an `isOverlay` flag and add the background config.

### 3. Frontend: add overlay compositing step in post-processing

**File: `src/pages/Index.tsx` → `postProcessVideo`**

After HeyGen video is ready and before bitrate reduction:
- Check if the video was generated in overlay mode (query `app_settings` or store `overlay_mode` + `background_video_url` on the video record)
- If overlay mode: use FFmpeg to composite the avatar video onto the background video using `overlay` filter
- Then proceed with normal bitrate reduction → subtitles pipeline

### 4. Store overlay metadata on the video record

**Migration**: Add two columns to `videos` table:
- `overlay_mode` (boolean, default false) — whether this video was generated in overlay mode
- `background_video_url` (text, nullable) — URL of the background video to composite onto

**File: `supabase/functions/generate-video-heygen/index.ts`**: Save these fields when creating the video.

### 5. FFmpeg overlay compositing utility

**New file: `src/lib/videoOverlay.ts`**

Create a function `overlayAvatarOnBackground(avatarVideoUrl, backgroundVideoUrl, onProgress?, signal?)`:
- Download both videos
- Use FFmpeg `filter_complex` with `chromakey` or `colorkey` filter to remove green screen, then `overlay` to composite onto background
- Return the composited File

## Implementation Order

1. Database migration (add `overlay_mode`, `background_video_url` to videos)
2. Backend: update `generate-video-heygen` to use green_screen background + save overlay metadata
3. Frontend validation popup in `handleGenerateVideo` / `handleFullVideoPipeline`  
4. New `videoOverlay.ts` utility for FFmpeg compositing
5. Integrate overlay step into `postProcessVideo` pipeline

## Technical Details

- HeyGen API supports `background: { type: "green_screen" }` in video_inputs to generate a green-screen video
- FFmpeg `colorkey` filter: `colorkey=color=0x00FF00:similarity=0.3:blend=0.1` removes green, then `overlay` composites
- The background video may be shorter/longer than avatar video — need to loop or trim background to match avatar duration

