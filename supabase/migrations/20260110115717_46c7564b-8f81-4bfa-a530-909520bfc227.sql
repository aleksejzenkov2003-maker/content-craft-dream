-- Add Submagic integration columns to video_projects
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS submagic_project_id text;
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS submagic_video_url text;
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;