

## Fix: Scene photo not showing in Info tab

**Problem**: Line 186 in `VideoDetailModal.tsx` searches for the scene photo among `advisor?.photos` (uploaded advisor portraits). It should instead show the generated scene image from `playlist_scenes` — which is already fetched into `scenePhotos` state (lines 80-104) but only used in the Generate tab.

**Fix** in `src/components/videos/VideoDetailModal.tsx`:

Replace the scene photo logic in the Info tab (lines 185-197) to prioritize `scenePhotos[0]` (from `playlist_scenes`), falling back to the advisor's `scene_photo_id` photo only if no playlist scene exists.

```tsx
// Current (wrong): looks in advisor.photos
const scenePhoto = advisor?.photos?.find(p => p.id === advisor?.scene_photo_id) || ...

// Fixed: prioritize actual scene from playlist_scenes
const sceneImage = scenePhotos[0]
  || advisor?.photos?.find(p => p.id === advisor?.scene_photo_id)
  || advisor?.photos?.find(p => p.is_primary);
```

Single file change, ~5 lines.

