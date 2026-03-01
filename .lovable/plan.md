

## Plan: Remove n8n, use edge function with direct video download + concat

### Problem
The current `concat-video` edge function relies on n8n for ffmpeg concatenation. The user wants to remove this dependency and use a library-based approach instead.

### Approach
Since Deno edge functions can't run ffmpeg natively, and ffmpeg.wasm is too heavy for edge functions (memory/time limits), the practical approach is:

**Rewrite `concat-video` to download both videos, concatenate them as binary blobs, and upload the result to storage.** For MP4 files with compatible codecs, we can do a binary concatenation by:
1. Downloading both video files
2. Using a simple binary append (for TS/fragmented MP4) or re-muxing
3. Uploading the result to Supabase storage
4. Updating the publication record

However, raw binary concat of MP4s doesn't work reliably without ffmpeg. The realistic alternative is **client-side concatenation using ffmpeg.wasm** in the browser.

### Revised plan

#### 1. Install `@ffmpeg/ffmpeg` and `@ffmpeg/util` (client-side)
- Add ffmpeg.wasm as a dependency
- Create a utility hook `useVideoConcat` that handles:
  - Loading ffmpeg.wasm
  - Downloading two videos (main + back cover)
  - Running `ffmpeg -f concat` in the browser
  - Uploading the result to Supabase storage
  - Updating the publication with `final_video_url`

#### 2. Update `concat-video` edge function
- Remove n8n dependency entirely
- Simplify to just update publication status and store the final URL
- Or remove the edge function and do everything client-side

#### 3. Add concat button to PublicationsTable
- For publications where the channel has a `back_cover_video_url`, show a "Склеить" button
- Clicking it triggers client-side ffmpeg.wasm concatenation
- Show progress/status during processing

### Files to change
- `supabase/functions/concat-video/index.ts` — remove or simplify (remove n8n)
- New: `src/hooks/useVideoConcat.ts` — client-side ffmpeg.wasm logic
- `src/components/publishing/PublicationsTable.tsx` — add concat button/status
- `package.json` — add `@ffmpeg/ffmpeg` and `@ffmpeg/util`

### Trade-offs
- ffmpeg.wasm runs in the browser, so large videos may be slow
- Works offline from external services (no n8n needed)
- No API keys or webhooks required

