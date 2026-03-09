

## Plan: Adopt n8n smart subtitle segmentation

### Problem
Current `generateSrtBlocks` uses fixed `wordsPerBlock=5` — naive chunking that ignores word length, duration, and natural pauses. The n8n workflow uses adaptive segmentation with 4 constraints that produce better-looking subtitles for Shorts/Reels.

### What to steal from n8n

**Smart word grouping** (the "Парсинг субтитров" node logic):
- `MAX_CHARS = 24` — max characters per subtitle line
- `MAX_WORDS = 8` — max words per segment  
- `MAX_DURATION = 2.4s` — max segment duration
- `GAP_SPLIT = 0.55s` — gap between words triggers new segment

This replaces the fixed `wordsPerBlock` approach entirely.

**Subtitle style** (the "Прожиг субтитров" ffmpeg command):
- `FontName=Montserrat` (vs current `Arial`)
- `FontSize=12` (scaled to PlayRes — equivalent to smaller text)
- `Bold=1, Outline=0.5, Shadow=0, MarginV=80`

### Changes

**File: `src/lib/srtGenerator.ts`**

1. Add new function `generateSmartBlocks(words, options?)` with the n8n segmentation logic (MAX_CHARS, MAX_WORDS, MAX_DURATION, GAP_SPLIT). Returns same `SrtBlock[]` format.
2. Update `generateAss()` to use `generateSmartBlocks` by default instead of fixed chunking.
3. Update default style: `fontName='Montserrat'`, `outline=1` (0.5 rounds up at 1080p), `marginV=80`.
4. Keep `generateSrtBlocks` (fixed chunking) available for backward compat / SRT download.

**File: `src/lib/videoSubtitles.ts`**

5. Update default options to match n8n style: Montserrat, outline=1, marginV=80.
6. Remove `wordsPerBlock` from `SubtitleOptions` (smart grouping handles it).

### Technical detail: smart segmentation algorithm

```text
for each word:
  if no current segment → start new
  else check:
    gap > 0.55s?          → flush, start new
    combined chars > 24?  → flush, start new  
    word count > 8?       → flush, start new
    duration > 2.4s?      → flush, start new
  otherwise → append to current
```

Identical logic to the n8n Code node, ported to TypeScript.

### Not changing
- `burnSubtitles` ffmpeg pipeline stays the same (ASS filter approach)
- The n8n's 3-part concat (cover + video + ending) is already handled by `concat-video` edge function separately
- Resolution stays 1080×1920 (our standard)

