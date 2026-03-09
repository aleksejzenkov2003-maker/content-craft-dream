

## Plan: Move video concat from binary MP4 parser to ffmpeg.wasm (browser-side)

### Problem
The current `concat-video` edge function uses a custom binary MP4 parser (~600 lines) that's fragile — breaks on codec mismatches, different timescales, missing tracks. The n8n approach uses ffmpeg's `concat` filter which handles all normalization automatically.

### Solution
Move the concat to the browser using ffmpeg.wasm (already loaded for subtitles). Use the same ffmpeg concat filter as n8n: normalize both videos to matching format, then concat.

### Changes

**1. New file: `src/lib/videoConcat.ts`** — browser-side concat via ffmpeg.wasm

Core logic (mirrors n8n's "Финальный монтаж"):
```
ffmpeg -i main.mp4 -i back.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k output.mp4
```

- Downloads both videos
- Writes to ffmpeg virtual FS
- Runs concat filter (handles different codecs/timescales automatically)
- Returns File blob
- Progress callback with phases: `downloading`, `concatenating`, `done`
- AbortSignal support

**2. Rewrite: `src/hooks/useVideoConcat.ts`**

- Remove edge function call + polling
- Instead: download videos → ffmpeg.wasm concat → upload result to Storage → update publication
- All done client-side with progress updates
- Upload final result directly to `media-files` bucket

**3. Keep edge function** as fallback but it won't be called by default anymore.

**4. Minor: `src/components/publishing/PublicationsTable.tsx`**
- Update progress display to show phase labels (downloading / concatenating / uploading)

### Why this works
- ffmpeg.wasm is already loaded for subtitles — no extra download
- `concat` filter re-encodes → guarantees codec compatibility (the exact problem the binary parser can't solve)
- Same approach as the proven n8n workflow
- No server-side ffmpeg needed

### Trade-off
- Client-side re-encoding is slower (~30-60s for typical short videos)
- But it actually works reliably vs binary parser that breaks

