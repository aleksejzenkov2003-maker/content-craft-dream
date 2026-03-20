
-- Table for background video overlays (like playlist_scenes but for video backgrounds)
CREATE TABLE public.background_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.background_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to background_videos" ON public.background_videos FOR ALL TO public USING (true) WITH CHECK (true);

-- Add avatar_photo_id to advisors (transparent/no-background photo for overlay mode)
ALTER TABLE public.advisors ADD COLUMN avatar_photo_id uuid REFERENCES public.advisor_photos(id) ON DELETE SET NULL;
