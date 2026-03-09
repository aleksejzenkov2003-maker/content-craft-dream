

## Plan: Hybrid subtitle burning — backend (primary) + browser (fallback)

### Problem analysis

The browser-side FFmpeg.wasm loading hangs at 5% because:
1. The code passes **direct CDN URLs** to `instance.load()`, but the FFmpeg library internally creates a Web Worker that cannot load scripts cross-origin
2. The officially recommended method is `toBlobURL` from `@ffmpeg/util` which converts files to same-origin blob URLs
3. No `ffmpeg-core.worker.js` exists in the UMD build of `@ffmpeg/core@0.12.6` — only `ffmpeg-core.js` + `ffmpeg-core.wasm`

### Solution: two-tier approach

#### Tier 1: Backend via n8n webhook (primary)

Create edge function `burn-subtitles/index.ts`:
- Receives `videoId` from frontend
- Reads video URL + `word_timestamps` from DB
- Generates ASS subtitle content server-side (port `srtGenerator.ts` logic)
- Sends `{videoUrl, assContent, videoId}` to existing n8n webhook (`N8N_WEBHOOK_URL`)
- n8n handles FFmpeg processing on its server (no browser WASM needed)
- n8n uploads result to storage and updates `video_path` in DB
- Returns immediately with `{status: "processing"}`

#### Tier 2: Browser FFmpeg (fallback)

Rewrite `ffmpegLoader.ts` using the **proven working pattern**:
- Use `toBlobURL` from `@ffmpeg/util` (the official method that handles cross-origin correctly)
- Pass only `coreURL` + `wasmURL` as blob URLs (no workerURL for UMD build)
- Add 30-second timeout with clear error message
- If loading fails, surface error to user instead of hanging

```text
User clicks "Burn Subtitles"
        │
        ▼
  Try backend (edge fn → n8n)
        │
   Success? ──Yes──► Done (n8n processes async)
        │
       No
        ▼
  Try browser FFmpeg (toBlobURL)
        │
   Success? ──Yes──► Burn in browser, upload
        │
       No
        ▼
  Offer SRT/ASS download
```

### Files to create/modify

1. **`supabase/functions/burn-subtitles/index.ts`** (new)
   - Edge function: reads video data, generates ASS, sends to n8n webhook
   - Lightweight — no video processing, just orchestration

2. **`src/lib/ffmpegLoader.ts`** (rewrite)
   - Use `toBlobURL` from `@ffmpeg/util` instead of custom fetch logic
   - Simpler, follows official FFmpeg.wasm examples
   - 30s timeout per CDN attempt

3. **`src/lib/videoSubtitles.ts`** (update)
   - Add `burnSubtitlesServer()` function that calls the edge function
   - Keep `burnSubtitles()` as browser fallback

4. **`src/components/videos/VideoSidePanel.tsx`** (update)
   - Try server-side first, fall back to browser, then offer SRT download
   - Show appropriate status messages for each path

### Technical details

**Browser FFmpeg fix** — the key change:
```typescript
import { toBlobURL } from '@ffmpeg/util';

const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
await instance.load({ coreURL, wasmURL });
```

**Edge function** — lightweight orchestration:
- Generates ASS content from word_timestamps (same logic as `srtGenerator.ts`)
- POSTs to n8n with video URL + ASS content
- n8n runs `ffmpeg -i video.mp4 -vf "ass=subs.ass" -c:a copy -c:v libx264 -preset fast -crf 23 output.mp4`

