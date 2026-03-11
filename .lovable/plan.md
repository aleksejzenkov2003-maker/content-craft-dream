

## Plan: Remove yellow subtitle box + add re-burn subtitles button

### Problem
1. Subtitles currently have a yellow box background (`box=1:boxcolor=yellow@0.65:boxborderw=10`) — need to remove it and use only a highlight color `#FFCC00`
2. The "re-burn subtitles" button in VideoSidePanel uses `heygen_video_url || video_path` as source — but `video_path` already contains subtitles after first burn, causing double-overlay
3. Need a way to store the bitrate-reduced (clean) URL separately so re-burning works on clean video

### Changes

**1. Add `reduced_video_url` column to `videos` table**
- DB migration: `ALTER TABLE videos ADD COLUMN reduced_video_url text;`
- This stores the bitrate-reduced video WITHOUT subtitles, so subtitle re-burns use this clean source

**2. Update `postProcessVideo` in `src/pages/Index.tsx`**
- After bitrate reduction upload, save URL to both `reduced_video_url` (permanent clean copy) and continue pipeline
- Final subtitled result still goes to `video_path`

**3. Update subtitle styling in `src/lib/videoSubtitles.ts`**
- Remove `box=1:boxcolor=yellow@0.65:boxborderw=10` from `buildDrawtextFilter`
- Change `fontcolor=white` to `fontcolor=#FFCC00` (the highlight color)
- Keep `borderw=2:bordercolor=black` for readability

**4. Update "Вшить субтитры" button in `src/components/videos/VideoSidePanel.tsx`**
- Change source URL priority: use `video.reduced_video_url` first (clean bitrate-reduced), then fall back to `heygen_video_url`
- Never use `video_path` as source (it may contain old subtitles)
- Add a second button "Переналожить субтитры" that appears when `video_path` exists and `reduced_video_url` or `heygen_video_url` is available — same logic but clearly re-burns on clean source

**5. Update `src/hooks/useVideos.ts`**
- Add `reduced_video_url` to the Video type and fetch query

