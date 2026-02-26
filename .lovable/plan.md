

## Plan: Fix 3 issues — active channels only, preserve selection after publish, stop notification loop

### Problem Analysis

1. **Inactive channels displayed**: `VideoSidePanel.tsx` line 181 iterates `publishingChannels` without filtering by `is_active`. The `VideosTable` already filters correctly (line 613), but the side panel does not.

2. **Selected channels reset after publish**: The `handlePublishVideo` function (Index.tsx lines 129-142) loops through channels calling `addPublication` sequentially. Each call triggers `fetchPublications()` + `toast.success('Публикация создана')`. This causes massive re-rendering and toast spam. The `selected_channels` field on the video is never cleared — the real issue is the cascade of re-fetches and toasts creating the appearance of a broken UI.

3. **Infinite notification loop**: For each channel, `addPublication` (usePublications.ts line 136) fires `toast.success('Публикация создана')`. Then auto-generate text fires for each publication (line 126), and afterward `fetchPublications()` runs again. With 13 channels selected, this produces 13+ toasts and 26+ data refetches — creating a flood of notifications and re-renders.

### Changes

#### 1. Filter inactive channels in VideoSidePanel (`src/components/videos/VideoSidePanel.tsx`)

Line ~181: Change `publishingChannels.map(...)` to `publishingChannels.filter(c => c.is_active).map(...)`.

#### 2. Rewrite `handlePublishVideo` to batch operations (`src/pages/Index.tsx`)

Replace the sequential loop (lines 129-142) with:
- Deduplicate first: check which video+channel pairs already exist
- Batch insert all new publications in a single DB call
- Skip auto-generate text during batch (or run it after all inserts)
- Show a single toast at the end
- Do NOT modify `selected_channels` — keep them as-is

```typescript
const handlePublishVideo = async (video: Video, channelIds: string[]) => {
  try {
    // Check existing pairs
    const { data: existing } = await supabase
      .from('publications')
      .select('channel_id')
      .eq('video_id', video.id)
      .in('channel_id', channelIds);
    
    const existingIds = new Set((existing || []).map(e => e.channel_id));
    const newChannelIds = channelIds.filter(id => !existingIds.has(id));
    
    if (newChannelIds.length === 0) {
      toast.info('Публикации уже существуют');
      return;
    }
    
    // Batch insert
    const { data: inserted, error } = await supabase
      .from('publications')
      .insert(newChannelIds.map(channelId => ({
        video_id: video.id,
        channel_id: channelId,
        publication_status: 'pending',
      })))
      .select('id');
    
    if (error) throw error;
    
    // Single toast
    toast.success(`Добавлено ${newChannelIds.length} публикаций`);
    
    // Generate text for all new publications (fire-and-forget, no toast each)
    for (const pub of (inserted || [])) {
      supabase.functions.invoke('generate-post-text', {
        body: { publicationId: pub.id },
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Error publishing video:', error);
    toast.error('Ошибка публикации');
  }
};
```

#### 3. Update `onBulkPublish` in Index.tsx (lines 285-298)

Update to use the new batched `handlePublishVideo` and show a single summary toast instead of per-video toasts.

### Files to modify
- `src/components/videos/VideoSidePanel.tsx` — filter `publishingChannels` by `is_active`
- `src/pages/Index.tsx` — rewrite `handlePublishVideo` to batch insert + single toast, no per-item notifications

