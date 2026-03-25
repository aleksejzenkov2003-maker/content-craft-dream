

## Fix: Unified Single Progress Bar for Video Processing

### Problem

The panel has **3 independent progress states** (`bitrateProgress`, `overlayProgress`, `subtitleProgress`) plus an **auto-processing progress** (`autoSubtitleProgress`) from `Index.tsx`. These can show simultaneously, display impossible values (645%), and compete for the shared FFmpeg instance.

### Root Cause

Each button manages its own state with no mutual exclusion. The auto-pipeline in `Index.tsx` also pushes progress independently. FFmpeg WASM is a single instance — running two processes simultaneously corrupts both.

### Solution

Replace the 3 separate progress states with **one unified state** in `VideoSidePanel.tsx`.

### Changes

**File: `src/components/videos/VideoSidePanel.tsx`**

1. **Replace 3 progress states with 1:**
   ```
   // REMOVE:
   bitrateProgress, overlayProgress, subtitleProgress, subtitleAbort, overlayAbort
   
   // ADD:
   processState: { type: 'bitrate' | 'overlay' | 'subtitles', phase: string, progress: number } | null
   processAbort: AbortController | null
   ```

2. **Single progress bar** below the 3 buttons:
   - Shows phase label (e.g., "Битрейт 45%", "Фон 41%", "Субтитры 72%")
   - Capped at 100%
   - Stop button always visible during processing

3. **Mutual exclusion**: All 3 buttons check `processState !== null` to disable. Only one process at a time.

4. **AbortController for bitrate** (currently missing — bitrate can't be stopped). Add it like overlay/subtitles already have.

5. **Auto-processing progress** (`autoSubtitleProgress` from Index.tsx): Show it in the same unified bar when no manual process is active. Auto-progress takes lower priority — if user clicks a manual button, auto-progress is hidden.

6. **Cap progress at 100%**: `Math.min(100, progress)` in all progress callbacks.

### UI Layout (unchanged button positions)

```text
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Битрейт  │ │   Фон    │ │ Субтитры │
└──────────┘ └──────────┘ └──────────┘
 ████████████░░░░░░░░  Фон 41%  [Стоп]
```

One progress bar, one label, one stop button.

### Files to Edit

| File | Change |
|---|---|
| `src/components/videos/VideoSidePanel.tsx` | Replace 3 progress states → 1 unified state; add AbortController to bitrate; cap progress; single progress bar |

