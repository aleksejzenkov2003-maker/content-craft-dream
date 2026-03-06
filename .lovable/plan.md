

## Problem

Across all screens, popups/panels show stale data because they store a **snapshot** of the object when opened. After mutations (delete, regenerate, update), the parent's data array gets refetched, but the panel still displays the old snapshot.

### Affected Components

| Component | Stale State Variable | Parent Data Source |
|---|---|---|
| `Index.tsx` → VideoSidePanel/VideoDetailModal | `viewingVideo` | `videos` array |
| `Index.tsx` → VideoEditorDialog | `editingVideo` | `videos` array |
| `ScenesMatrix.tsx` → SceneSidePanel | `selectedScene` | `scenes` array |
| `AdvisorsGrid.tsx` → Dialog | `selectedAdvisor` | `advisors` prop |

### Fix Strategy

Replace snapshot-based state with **ID-based derivation**: store only the ID, derive the full object from the live data array.

### Changes

**1. `src/pages/Index.tsx`**
- Replace `viewingVideo: Video | null` with `viewingVideoId: string | null`
- Replace `editingVideo: Video | null` with `editingVideoId: string | null`  
- Derive actual objects: `const viewingVideo = videos.find(v => v.id === viewingVideoId) ?? allVideos.find(v => v.id === viewingVideoId) ?? null`
- Same for `editingVideo`
- Update all `setViewingVideo(video)` → `setViewingVideoId(video.id)`, etc.
- Prev/Next navigation: just set the new ID

**2. `src/components/scenes/ScenesMatrix.tsx`**
- Replace `selectedScene: PlaylistScene | null` with `selectedSceneId: string | null`
- Derive: `const selectedScene = scenes.find(s => s.id === selectedSceneId) ?? null`
- Remove the manual `setSelectedScene({ ...selectedScene, ...updates })` patch in `handleUpdateScene`

**3. `src/components/advisors/AdvisorsGrid.tsx`**
- Replace `selectedAdvisor: Advisor | null` with `selectedAdvisorId: string | null`
- Derive: `const selectedAdvisor = advisors.find(a => a.id === selectedAdvisorId) ?? null`

This ensures every time the data arrays refresh (after any mutation), the panels automatically show the latest data without manual synchronization.

