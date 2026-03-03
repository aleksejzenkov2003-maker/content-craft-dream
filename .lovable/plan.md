

## Problem

The channel count number next to the airplane icon doesn't match the actual number of visible/active selected channels. Currently it counts all IDs in `selected_channels` array (line 797), but some of those IDs may refer to inactive or deleted channels. The count should only include channels that exist in the active `publishingChannels` list.

## Fix

### `src/components/videos/VideosTable.tsx`
- Line 797: Change from counting raw array length to counting only channels that match active publishing channels:

```typescript
// Before:
const selectedCount = video.selected_channels?.length || 0;

// After:
const selectedCount = publishingChannels
  .filter(c => c.is_active && video.selected_channels?.includes(c.id))
  .length;
```

This ensures the displayed number matches exactly the channels visible in the tooltip/popover (which already filters by `is_active` on line 815).

