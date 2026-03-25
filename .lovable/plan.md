

## Fix: Overlay Pipeline Failures and Missing Videos

### Root Cause Analysis (from DB logs)

**Problem 1 — HeyGen URLs expire during download**
Activity logs show `overlay_compositing_failed: TypeError: Failed to fetch` for video #9373. The HeyGen CDN URLs have `Expires=` parameters and become unreachable after some time. The overlay tries to download the avatar video but gets a network error.

**Problem 2 — Manual "Фон" button doesn't update `video_path`**
Line 675 in VideoSidePanel only saves to `reduced_video_url`. The video player displays `video_path`, so even when overlay succeeds, nothing appears. DB confirms: #9373 has `reduced_video_url` (overlay file) but `video_path: null`.

**Problem 3 — Auto-pipeline re-triggers multiple times**
Activity logs show 7+ `overlay_compositing_started` events for #9373. The `postProcessingRef` guard is being bypassed — likely because the video status change from the check-video-status polling triggers `postProcessVideo` again before the previous run finishes.

**Problem 4 — Pipeline doesn't save partial progress**
If overlay succeeds but bitrate/subtitles fail, `video_path` stays null. There is no fallback to save whatever was successfully produced.

### Fixes

**File: `src/components/videos/VideoSidePanel.tsx`**

| Issue | Fix |
|---|---|
| "Фон" button only updates `reduced_video_url` | Also update `video_path` with overlay URL and set `reel_status: 'ready'` |
| No variant created for overlay result | Insert a variant record for the overlay file after upload |

**File: `src/pages/Index.tsx`**

| Issue | Fix |
|---|---|
| Pipeline re-triggers | After overlay completes, immediately save `video_path` as fallback (so if bitrate/subtitles fail, we still have something) |
| HeyGen URL fetch fails silently | Add retry with timeout and better error logging; if fetch fails, try using `reduced_video_url` as fallback source |
| Duplicate pipeline calls | Clear `reel_status` to `generating` atomically at the start; check DB status before starting (not just in-memory Set) |

**File: `src/lib/videoOverlay.ts`**

| Issue | Fix |
|---|---|
| No timeout on fetch | Add 60-second timeout on `fetchAsset` calls to prevent hanging forever |

### Specific Changes

1. **VideoSidePanel "Фон" button (line 675)**: Change from:
   ```typescript
   onUpdateVideo(video.id, { reduced_video_url: urlData.publicUrl });
   ```
   To:
   ```typescript
   onUpdateVideo(video.id, { 
     reduced_video_url: urlData.publicUrl,
     video_path: urlData.publicUrl,
     reel_status: 'ready'
   });
   ```
   Then also insert a variant for the overlay result.

2. **Auto-pipeline overlay fallback (Index.tsx ~line 299)**: After overlay succeeds, immediately save `video_path = finalUrl` so even if subsequent steps fail, the overlay is preserved:
   ```typescript
   await supabase.from('videos').update({ video_path: finalUrl }).eq('id', videoId);
   ```

3. **fetchAsset timeout (videoOverlay.ts)**: Add `AbortSignal.timeout(60000)` combined with the user signal to prevent hanging downloads.

4. **DB recovery**: Fix #9373 and #9706 — set their `video_path` from existing overlay URLs and reset `reel_status`.

