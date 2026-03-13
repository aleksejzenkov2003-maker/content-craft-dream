

## Upload Video to Website (wisdomdialogue.ai)

### Overview
Create an edge function that uploads the final video to the website via its admin API (Vimeo-based), and auto-trigger it for publications in the "Website Video" channel.

### Secret Required
Store the JWT token as `WEBSITE_API_TOKEN` secret.

### Edge Function: `upload-to-website`

**Input**: `{ publicationId: string }`

**Flow**:
1. Fetch publication with joined video data (`question_id`, `advisor_id`, `final_video_url` / `video_path`)
2. Download the video file into memory
3. `POST https://www.wisdomdialogue.ai/api/admin/video-guides/{questionId}/guide/{advisorId}/upload` with Bearer token → get `uploadLink`, `embedUrl`
4. Upload video binary via `PUT` to tus upload link with required headers (`Tus-Resumable`, `Upload-Offset`, `Content-Type: application/offset+octet-stream`)
5. Update publication: `post_url = embedUrl`, `publication_status = 'published'`
6. Log to `activity_log`

### Auto-trigger Integration
In `handlePublishVideo` (Index.tsx): after creating publications for "Website Video" channels (where `network_type === 'website'` and channel name includes "Video"), automatically invoke the edge function. This integrates into the existing `publish_social` automation setting.

### Config
Add `[functions.upload-to-website]` with `verify_jwt = false` to `config.toml`.

### Files Changed
1. **New**: `supabase/functions/upload-to-website/index.ts`
2. **Edit**: `supabase/config.toml` — add function config
3. **Edit**: `src/pages/Index.tsx` — auto-trigger after publication creation for website channels

