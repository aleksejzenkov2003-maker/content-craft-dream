-- Phase 2.6: Add selected_channels array to videos for channel selection
ALTER TABLE videos ADD COLUMN IF NOT EXISTS selected_channels uuid[] DEFAULT '{}';