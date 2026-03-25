

## Fix: Enforce Strict Sequential Pipeline Order

### Problem

The post-processing pipeline has correct sequential code (overlay → bitrate → subtitles), but:
1. **Toast messages are misleading** — overlay is labeled "Шаг 0", bitrate "Шаг 1/2", subtitles "Шаг 2/2". With overlay, it should be 3 steps total (1/3, 2/3, 3/3).
2. **Auto-resume can re-trigger** while FFmpeg is still running the overlay, causing subtitles to start in parallel on a stale URL.
3. **The overlay condition check** (`!sourceUrl.includes('_overlay_')`) is fragile — if the URL doesn't contain that substring pattern, overlay re-runs or gets skipped incorrectly.

### Solution

**File: `src/pages/Index.tsx` — `postProcessVideo` function**

1. **Dynamic step labeling**: Detect upfront how many steps will run (overlay + bitrate + subtitles) and number toasts accordingly (e.g. "Шаг 1/3: Наложение фона", "Шаг 2/3: Битрейт", "Шаг 3/3: Субтитры").

2. **Atomic DB guard at start**: Before starting, check DB `reel_status` — if it's already `'generating'`, skip (not just in-memory Set). This prevents resume logic from launching a duplicate.

3. **Fix overlay skip condition**: Replace the fragile `!sourceUrl.includes('_overlay_')` check with a proper flag. After overlay completes, set a local variable `overlayDone = true` and also check `activity_log` for `overlay_compositing_complete` to avoid re-running on resume.

4. **Save `video_path` after each step**: Already partially done (overlay saves), extend to bitrate step too — so if subtitles fail, the reduced version is preserved as `video_path`.

### Specific Changes

| Location | Change |
|---|---|
| Line 233 | Add DB-level guard: fetch `reel_status` and skip if already `'generating'` |
| Lines 252-301 | Update overlay toast from "Шаг 0" to dynamic "Шаг N/M" |
| Lines 303-334 | Update bitrate toast from "Шаг 1/2" to dynamic label; save `video_path` after bitrate |
| Lines 336-375 | Update subtitles toast from "Шаг 2/2" to dynamic label |
| Line 253 | Replace `!sourceUrl.includes('_overlay_')` with a check against `activity_log` for the current `generation_count` |

### Step Numbering Logic

```text
totalSteps = 0
if overlay_mode && background_video_url → totalSteps++
if resize enabled → totalSteps++
if subtitles enabled && word_timestamps → totalSteps++

currentStep = 0
// Before each phase: currentStep++, toast "Шаг {currentStep}/{totalSteps}: ..."
```

### DB Guard Addition (top of postProcessVideo)

```typescript
// Check DB to prevent duplicate runs (not just in-memory)
const { data: statusCheck } = await supabase
  .from('videos')
  .select('reel_status')
  .eq('id', videoId)
  .single();
if (statusCheck?.reel_status === 'generating') {
  console.log(`[postProcess] DB shows generating for ${videoId}, skipping`);
  return;
}
```

