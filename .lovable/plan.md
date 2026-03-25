

## Completed: Overlay Watchdog + Stale Recovery

### Changes Made

1. **`src/lib/videoOverlay.ts`** — Watchdog + performance fix:
   - Wrapped `ff.exec()` in a 5-minute hard watchdog timeout
   - On timeout: terminates FFmpeg, throws error with last 10 FFmpeg log lines
   - Changed preset from `slow` → `medium`, CRF from `20` → `23` (2-3x faster)
   - Added FFmpeg log collection (last 200 lines) for diagnostics on failure

2. **`src/pages/Index.tsx`** — Fixed conflicting guards + stale recovery:
   - Removed DB-level guard (`reel_status === 'generating' → skip`) that blocked auto-resume
   - Auto-resume now checks `activity_log` age: if last `*_started` entry is >5 min old, marks video as `error` instead of re-triggering
   - For non-stale stuck videos, resets `reel_status` to `null` before calling `postProcessVideo`
   - Logs `postprocessing_stale_timeout` to activity_log with stale action name and age
