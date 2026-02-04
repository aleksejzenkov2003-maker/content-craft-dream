-- Drop existing foreign key constraints and recreate with CASCADE

-- advisor_photos -> advisors
ALTER TABLE public.advisor_photos
  DROP CONSTRAINT IF EXISTS advisor_photos_advisor_id_fkey;

ALTER TABLE public.advisor_photos
  ADD CONSTRAINT advisor_photos_advisor_id_fkey
  FOREIGN KEY (advisor_id) REFERENCES public.advisors(id) ON DELETE CASCADE;

-- videos -> advisors (set null instead of cascade to preserve videos)
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_advisor_id_fkey;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_advisor_id_fkey
  FOREIGN KEY (advisor_id) REFERENCES public.advisors(id) ON DELETE SET NULL;

-- playlist_scenes -> advisors (set null to preserve scenes)
ALTER TABLE public.playlist_scenes
  DROP CONSTRAINT IF EXISTS playlist_scenes_advisor_id_fkey;

ALTER TABLE public.playlist_scenes
  ADD CONSTRAINT playlist_scenes_advisor_id_fkey
  FOREIGN KEY (advisor_id) REFERENCES public.advisors(id) ON DELETE SET NULL;