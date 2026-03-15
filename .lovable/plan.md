

## Problems

1. **Video "disappears" on re-generation**: `handleFullVideoPipeline` nullifies `heygen_video_url`, `video_path`, etc. — the video card/side panel shows "no video" and looks like the record vanished.
2. **First video's subtitle process gets no visibility during second video's generation**: No per-video pipeline stage indicator — only `generation_status` and `reel_status` exist but the side panel doesn't show `reel_status` states (post-processing) alongside generation.
3. **No generation count**: No `generation_count` column exists, so user can't see how many times a video was regenerated.
4. **Buttons not locked during post-processing**: The disable logic checks `generation_status === 'generating'` but ignores `reel_status === 'generating'` (bitrate/subtitles in progress).

## Plan

### 1. Add `generation_count` column (DB migration)
```sql
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS generation_count integer DEFAULT 0;
```

### 2. Increment `generation_count` on each generation (`Index.tsx`)
In both `handleFullVideoPipeline` and `handleGenerateVideo`, when clearing old artifacts, also increment `generation_count`:
```typescript
generation_count: (video.generation_count || 0) + 1
```

### 3. Add `generation_count` to Video interface (`useVideos.ts`)
```typescript
generation_count: number | null;
```

### 4. Lock buttons during post-processing (`VideoSidePanel.tsx`)
Add `reel_status === 'generating'` to the disabled condition on all three step buttons:
```typescript
disabled={... || video.reel_status === 'generating'}
```

### 5. Show current pipeline stage in side panel (`VideoSidePanel.tsx`)
Above the 3-column grid, add a status banner showing the current stage:
- `generation_status === 'generating'` → "⏳ Генерация видео HeyGen..."
- `reel_status === 'generating'` → "⏳ Постобработка (битрейт/субтитры)..."
- `generation_status === 'error'` or `reel_status === 'error'` → "❌ Ошибка"
- Show `generation_count` as badge: "Генерация #N"

### 6. Display generation count in side panel meta section
Add row: "Количество генераций" → `video.generation_count || 0`

### 7. Ensure video doesn't "disappear" from the table
The `resolveStatus` function in `VideosTable` returns `'generating'` when `generation_status === 'generating'` — this should already keep it visible. The real issue is the side panel showing empty video section. The existing `videoVariants` array becomes empty when URLs are nullified. Add a "generating" placeholder that shows during generation so the video section doesn't look empty.

### Files to change
- **DB migration**: Add `generation_count` column
- **`src/hooks/useVideos.ts`**: Add `generation_count` to interface
- **`src/pages/Index.tsx`**: Increment count on generation, add `reel_status` to `localBusy` reset
- **`src/components/videos/VideoSidePanel.tsx`**: Lock buttons during post-processing, show pipeline stage banner, show generation count

