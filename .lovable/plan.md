

## Analysis of n8n Workflows vs Current Edge Functions

From the uploaded n8n workflows, the real production logic has two critical differences from the current implementation:

### 1. Cover Creation is a 2-Step Process

**n8n logic (correct):**
1. **Step 1 - Atmosphere**: Claude generates a visual concept prompt from question/hook/answer/religion, then Kie.ai `google/nano-banana` generates a background atmosphere image (no avatar)
2. **Step 2 - Overlay ("Подписать обложку")**: Kie.ai `nano-banana-pro` takes the atmosphere image + advisor photo as `image_input` and composites a circular avatar portrait onto the background

**Current `generate-cover` edge function (wrong):** Does everything in ONE step with a text-only prompt asking for a background with a circle portrait embedded. No actual photo compositing happens.

### 2. Video Generation Uses Scene Photo, Not Just Avatar

**n8n logic (correct):**
1. Find the **scene** (Фото сцены) for the video's playlist+advisor combination
2. Download the scene photo (which is a composite of advisor + background)
3. Upload it to HeyGen as a new asset via `POST /upload/v1/asset` → get `image_key`
4. Upload voiceover audio to HeyGen → get `audio_asset_id`
5. Call HeyGen **`/v2/video/av4/generate`** with `image_key`, `audio_asset_id`, and `custom_motion_prompt`

**Current `generate-video-heygen` edge function (wrong):**
- Uses a pre-uploaded `talking_photo_id` (just the raw avatar photo)
- Calls HeyGen `/v2/video/generate` with `talking_photo` character type
- Does NOT use the scene as the background image

### Plan

#### A. Rewrite `generate-cover` edge function — 2-step process

1. Accept `videoId` and optionally `atmospherePrompt`
2. Fetch video data (question, hook, answer) + advisor info (name, religion/playlist) + advisor primary photo URL
3. **Step 1**: Call AI (Lovable AI gateway with gemini-2.5-flash) to generate atmosphere prompt from content, then send to Kie.ai `google/nano-banana` to generate the atmosphere background
4. Save `atmosphere_url` to video record, set `cover_status = 'atmosphere_ready'`
5. **Step 2**: Call Kie.ai `nano-banana-pro` with the atmosphere image + advisor photo as `image_input` to composite the circular avatar overlay
6. Save final `front_cover_url`, set `cover_status = 'ready'`

New DB fields needed on `videos` table:
- `atmosphere_url` (text) — stores the intermediate atmosphere image
- `atmosphere_prompt` (text) — stores the generated atmosphere prompt

#### B. Rewrite `generate-video-heygen` edge function — use scene photo

1. Fetch video with advisor and playlist data
2. Look up the **scene** from `playlist_scenes` matching the video's `playlist_id` + `advisor_id` with status 'approved' and a `scene_url`
3. If no scene found, fall back to current behavior (talking_photo_id)
4. If scene found:
   - Download the scene image
   - Upload it to HeyGen via `POST https://upload.heygen.com/v1/asset` → get `image_key`
   - Generate/use voiceover, upload audio to HeyGen → get `audio_asset_id`
   - Call **`POST /v2/video/av4/generate`** with `image_key`, `audio_asset_id`, and `custom_motion_prompt: "calm spiritual mentor, light hand movement, soft breathing, subtle head motion, natural eye contact, steady posture, gentle facial expressions, slow rhythm"`
5. Save `heygen_video_id` to video record

#### C. Add DB migration for new fields

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS atmosphere_url text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS atmosphere_prompt text;
```

#### D. Update UI to show atmosphere step

In `VideoSidePanel.tsx`, display `atmosphere_url` as an intermediate preview and show the 2-step cover status (atmosphere → final cover).

### Files to modify
- `supabase/functions/generate-cover/index.ts` — full rewrite to 2-step
- `supabase/functions/generate-video-heygen/index.ts` — use scene photo + av4 API
- DB migration — add `atmosphere_url`, `atmosphere_prompt` columns
- `src/components/videos/VideoSidePanel.tsx` — show atmosphere preview

