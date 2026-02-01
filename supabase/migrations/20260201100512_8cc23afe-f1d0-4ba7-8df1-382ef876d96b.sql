-- Phase 6.1: Add back cover columns to publishing_channels
ALTER TABLE publishing_channels ADD COLUMN IF NOT EXISTS back_cover_url text;
ALTER TABLE publishing_channels ADD COLUMN IF NOT EXISTS back_cover_video_url text;