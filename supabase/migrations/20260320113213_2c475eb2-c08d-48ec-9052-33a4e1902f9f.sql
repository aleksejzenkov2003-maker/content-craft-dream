
-- 1. Create background_assignments table
CREATE TABLE public.background_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  background_id uuid NOT NULL REFERENCES public.background_videos(id) ON DELETE CASCADE,
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.background_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to background_assignments"
  ON public.background_assignments FOR ALL TO public
  USING (true) WITH CHECK (true);

-- 2. Migrate existing data: move playlist_id/advisor_id combos to assignments
INSERT INTO public.background_assignments (background_id, playlist_id, advisor_id)
SELECT id, playlist_id, advisor_id FROM public.background_videos
WHERE playlist_id IS NOT NULL AND advisor_id IS NOT NULL;

-- 3. Alter background_videos: drop old columns, rename video_url, add media_type
ALTER TABLE public.background_videos
  DROP COLUMN IF EXISTS playlist_id,
  DROP COLUMN IF EXISTS advisor_id;

ALTER TABLE public.background_videos
  RENAME COLUMN video_url TO media_url;

ALTER TABLE public.background_videos
  ADD COLUMN media_type text NOT NULL DEFAULT 'video';
