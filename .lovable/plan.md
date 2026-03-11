

## Problem

Currently `postProcessVideo` runs silently in the background after HeyGen completes. It uses simple `toast.info` messages but there is no progress indication in the UI panel. The manual subtitle burning in VideoSidePanel has a detailed progress bar with phases, but the automatic pipeline does not.

## Plan

**Enhance `postProcessVideo` in `src/pages/Index.tsx`** to show clear phase-separated toast notifications:

1. **Phase 1 complete**: When HeyGen video is ready, show a persistent toast: "✅ Видео создано! Запуск наложения субтитров..."
2. **Phase 2 progress**: During bitrate reduction and subtitle burning, show updating toasts with phase info
3. **Phase 2 complete**: Show success toast: "✅ Субтитры наложены! Видео готово."

**Connect automatic subtitle progress to VideoSidePanel** — when post-processing runs for the currently viewed video, the side panel should reflect subtitle progress:

1. Add a shared state (via a ref or context) in `Index.tsx` for `postProcessingStatus: Record<string, { phase: string; progress: number }>`
2. Pass progress callback to `burnSubtitlesBrowser` in `postProcessVideo` (same as manual flow)
3. Pass `postProcessingStatus` to `VideoSidePanel` so it shows the progress bar during automatic processing
4. Add distinct toasts between phases:
   - After bitrate reduction: `toast.success('Шаг 1: Битрейт уменьшен. Начинаем вшивку субтитров...')`
   - After subtitles: `toast.success('Шаг 2: Субтитры вшиты! Видео полностью готово.')`
   - On subtitle failure: keep existing fallback behavior

### Files to modify
- `src/pages/Index.tsx` — enhance `postProcessVideo` with clearer toast notifications and pass subtitle progress state
- `src/components/videos/VideoSidePanel.tsx` — accept optional `autoSubtitleProgress` prop to show progress bar during automatic processing

