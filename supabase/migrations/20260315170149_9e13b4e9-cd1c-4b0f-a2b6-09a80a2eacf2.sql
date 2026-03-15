ALTER TABLE public.playlist_scenes
  ADD COLUMN motion_type TEXT DEFAULT NULL,
  ADD COLUMN motion_prompt TEXT DEFAULT NULL,
  ADD COLUMN motion_avatar_id TEXT DEFAULT NULL;