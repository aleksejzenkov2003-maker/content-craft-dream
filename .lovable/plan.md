

## Improve Video Generation Flow

The video generation via HeyGen is already implemented in `generate-video-heygen` edge function and matches the n8n workflow logic (upload scene photo + upload audio to HeyGen assets, then call `/v2/video/av4/generate`). However, the UI flow has issues:

### Current Problems
1. The "Generate" button in VideosTable calls `onGenerateVideo` which just opens the side panel — it doesn't actually trigger generation
2. The side panel "Generate Video" button calls `onGenerateVideo(video)` which also opens a detail modal, not the actual generation
3. Video generation should require `voiceover_url` to be present (voiceover must be done first)
4. No status polling after generation starts from the table/side panel

### Changes

#### 1. Update `Index.tsx` — Fix `handleGenerateVideo` handler
- Create a proper `handleGenerateVideo(video)` that:
  - Checks if `voiceover_url` exists, shows error if not ("Сначала создайте озвучку")
  - Calls `generate-video-heygen` edge function with `videoId`
  - The edge function already handles finding scene photo and using existing voiceover_url
  - Starts polling via `check-video-status`
- Wire `onGenerateVideo` in VideosTable to actually call this handler (not open side panel)

#### 2. Update `VideosTable.tsx` — Video button requires voiceover
- Disable "Generate" button when `voiceover_url` is missing
- Show tooltip "Сначала создайте озвучку"

#### 3. Update `VideoSidePanel.tsx` — Wire generation properly
- "Generate Video" button should also check for `voiceover_url`
- Pass proper handler from Index.tsx

#### 4. Add polling for video status
- After calling `generate-video-heygen`, poll `check-video-status` every 10-15 seconds
- Update UI when status changes to `ready` or `error`
- The `useVideoGeneration` hook already has polling logic — reuse it or replicate in Index.tsx

### Files to modify
- `src/pages/Index.tsx` — fix handler, add polling
- `src/components/videos/VideosTable.tsx` — disable button without voiceover
- `src/components/videos/VideoSidePanel.tsx` — wire generation properly

