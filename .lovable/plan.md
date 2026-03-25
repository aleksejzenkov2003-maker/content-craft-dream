

## Refactor: Fix Video Processing Bugs in VideoSidePanel

### Bugs Found

1. **Bitrate: AbortController created but never passed to FFmpeg** (line 599). `reduceVideoBitrate(src, callback)` accepts `signal` as 3rd param but it's not passed. Stop button does nothing for bitrate.

2. **Auto-progress: no Stop button**. When `autoSubtitleProgress` is active and `processState` is null, the progress bar renders but the Stop button is guarded by `{processState && ...}` — so it never appears.

3. **No cleanup on unmount or video switch**. If the user closes the panel or navigates to another video mid-process, the AbortController is not aborted and progress callbacks keep firing on stale state.

### Fixes

**File: `src/components/videos/VideoSidePanel.tsx`**

| Bug | Fix |
|---|---|
| Bitrate missing signal | Pass `ac.signal` as 3rd argument to `reduceVideoBitrate(src, callback, ac.signal)` |
| Auto-progress no Stop | Add `onCancelAutoProcess` callback prop. Show Stop button for auto-progress too, calling this callback. In `Index.tsx`, wire it to abort the auto-pipeline |
| No cleanup on unmount | Add `useEffect` cleanup that aborts `processAbort` when panel closes or `video.id` changes |

**File: `src/pages/Index.tsx`**

| Change | Detail |
|---|---|
| Add auto-process abort support | Store `AbortController` for each auto-processing video. Pass `onCancelAutoProcess` to `VideoSidePanel` that aborts the controller and clears progress |

### New prop on VideoSidePanel

```typescript
onCancelAutoProcess?: () => void;
```

### Cleanup effect

```typescript
useEffect(() => {
  return () => {
    processAbort?.abort();
  };
}, [video?.id, open]);
```

### Stop button logic (unified)

The Stop button will appear whenever any progress is visible (manual OR auto), and will call the appropriate abort mechanism.

