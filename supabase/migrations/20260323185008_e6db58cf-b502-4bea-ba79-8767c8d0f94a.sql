ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS overlay_mode boolean DEFAULT false;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS background_video_url text;