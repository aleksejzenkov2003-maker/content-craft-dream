

## Plan: Video Pipeline Automation & Publication Controls

### Changes Overview

Seven requirements across 3 files: `VideoSidePanel.tsx`, `Index.tsx` (handlers), and `generate-voiceover-for-video/index.ts`.

---

### 1. Regeneration buttons with cycle icon (🔄)

**File: `src/components/videos/VideoSidePanel.tsx`**

Replace "Шаг 1. ФОН" and "Шаг 2. Обложка" button icons with `RefreshCw` (cycle) icon from lucide. Keep the existing `onClick` handlers. The buttons already call `onGenerateAtmosphere` and `onGenerateCover`.

### 2. Voiceover uses advisor's ElevenLabs settings

**File: `supabase/functions/generate-voiceover-for-video/index.ts`**

The edge function already fetches `advisor.elevenlabs_voice_id` and uses it (line 45). However, it hardcodes `voice_settings` and ignores `speech_speed`. Fix:
- Add `speech_speed` to the advisor select query
- Use `advisor.speech_speed` as the `speed` parameter in `voice_settings`

```typescript
// Line 33: add speech_speed to select
.select(`*, advisor:advisors (id, name, elevenlabs_voice_id, speech_speed)`)

// Line 59: use advisor's speech_speed  
voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: video.advisor?.speech_speed || 1.0 },
```

### 3. "Шаг 3. Видео" triggers full pipeline

**File: `src/pages/Index.tsx`** — Modify `handleGenerateVideo` to chain:
1. HeyGen video generation (existing)
2. After polling confirms video is ready → bitrate reduction via `normalizeVideoAudio` (download HeyGen video → FFmpeg re-encode with lower bitrate → upload)
3. Burn subtitles via `burnSubtitlesHybrid` (if `word_timestamps` exist)
4. Update `video_path` with the final processed URL

The polling callback (`check-video-status`) already detects `ready` status. Add post-processing logic after `status === 'ready'`:
- Download the HeyGen video
- Re-encode with reduced bitrate using a new `reduceVideoBitrate` function in `videoNormalizer.ts` (re-encode video stream to libx264 with CRF 28 + preset fast, not just copy)
- Burn subtitles onto the reduced video
- Upload final result as `video_path`

**File: `src/lib/videoNormalizer.ts`** — Add `reduceVideoBitrate` function that re-encodes video with lower bitrate (CRF 28, libx264, preset fast, aac audio).

### 4. "Готовность" checkbox controls Publish button

**File: `src/components/videos/VideoSidePanel.tsx`**

- Add `isReady` state (boolean), initialized from `video.is_ready` or false
- Add `Checkbox` labeled "Готовность" next to channel selection
- When unchecked, the "Отправить на подготовку к публикации" button is disabled with a tooltip "Поставьте галочку «Готовность»"
- On toggle, save to DB via `onUpdateVideo`

This requires adding an `is_ready` boolean column to the `videos` table (migration).

### 5. Publish button triggers text generation + back cover concat

Already implemented in `handlePublishVideo` (Index.tsx lines 362-437):
- Deduplication check (lines 365-377) ✅
- Text generation fire-and-forget (lines 406-410) ✅
- Auto-concat with back cover (lines 412-432) ✅

No changes needed here — logic already correct.

### 6. Deduplication check

Already implemented (lines 364-377 in Index.tsx). The function checks existing publications and only creates new ones for channels that don't already have a publication for this video. Shows "Публикации уже существуют" toast when all duplicates. ✅

### 7. Re-publish only adds new channels

Already implemented — `newChannelIds` filters out `existingIds` (line 372). Only new channel-video pairs get created. ✅

---

### Database Migration

Add `is_ready` boolean column to `videos`:
```sql
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false;
```

### Summary of File Changes

| File | Change |
|------|--------|
| `src/components/videos/VideoSidePanel.tsx` | Cycle icons on regen buttons, add Готовность checkbox, disable publish when unchecked |
| `src/pages/Index.tsx` | Chain bitrate reduction + subtitle burn after HeyGen ready |
| `src/lib/videoNormalizer.ts` | Add `reduceVideoBitrate` function |
| `supabase/functions/generate-voiceover-for-video/index.ts` | Pass advisor's `speech_speed` to ElevenLabs |
| DB migration | Add `is_ready` column |

