

## Plan: Self-contained edge function for subtitle burning (without n8n)

### Architecture

The edge function `burn-subtitles` will be completely rewritten to handle the entire process internally: read video data, generate ASS subtitles, download video, burn subtitles using FFmpeg WASM in Deno, upload result, and update the database. No n8n, no external services.

```text
Frontend: click "Вшить субтитры"
        │
        ▼
  Edge function (burn-subtitles)
        ├── Read video + timestamps from DB
        ├── Generate ASS content
        ├── Download video binary
        ├── Run ffmpeg.wasm in Deno runtime
        ├── Upload result to storage
        └── Update video_path in DB
        │
        ▼
  Frontend polls/checks for result
        │
   Fallback if edge fn fails:
        ▼
  Browser FFmpeg (fixed) → or SRT download
```

### Changes

1. **`supabase/functions/burn-subtitles/index.ts`** — full rewrite:
   - Remove ALL n8n references
   - Load `@aspect-build/aspect-ffmpeg` or raw ffmpeg.wasm for Deno
   - Process video server-side: `-vf "ass=subs.ass" -c:a copy -c:v libx264 -preset ultrafast -crf 28`
   - Upload to `media-files` bucket, update `videos.video_path`
   - Return `{ status: 'completed', videoUrl }` or `{ status: 'error' }`

2. **`src/lib/ffmpegLoader.ts`** — fix browser fallback:
   - The real root cause of the 5% hang: the `@ffmpeg/ffmpeg` wrapper creates an internal Web Worker, and the FFmpeg core's `_locateFile` function needs a valid `workerURL` even in UMD build
   - Check if `typeof SharedArrayBuffer !== 'undefined'` before attempting load (cross-origin iframe may block it)
   - Add a 30-second hard timeout on `instance.load()` with explicit error instead of silent hang
   - If SharedArrayBuffer unavailable, skip browser FFmpeg and go straight to edge function or SRT download

3. **`src/lib/videoSubtitles.ts`** — simplify:
   - `burnSubtitlesServer()` — calls edge function, polls for completion
   - Remove all n8n references and comments
   - `burnSubtitlesBrowser()` — unchanged but with better error surfacing

4. **`src/components/videos/VideoSidePanel.tsx`** — update flow:
   - Try server (edge function) first
   - If server fails, try browser FFmpeg with 30s timeout
   - If browser fails, offer SRT/ASS download
   - Add polling mechanism to check when server processing is done

### Constraints

- Edge functions have ~150s timeout and ~256MB memory
- For 1-3 min videos (~30-100MB), this should work with `-preset ultrafast`
- FFmpeg WASM in Deno: uses `npm:@ffmpeg/ffmpeg` with Deno compatibility
- If edge function hits limits, browser fallback kicks in automatically

### Config

- Add `[functions.burn-subtitles] verify_jwt = false` to config.toml
- No new secrets needed — uses existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

