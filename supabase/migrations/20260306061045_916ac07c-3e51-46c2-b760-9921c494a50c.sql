ALTER TABLE public.advisors 
  ADD COLUMN scene_photo_id uuid REFERENCES public.advisor_photos(id) ON DELETE SET NULL,
  ADD COLUMN thumbnail_photo_id uuid REFERENCES public.advisor_photos(id) ON DELETE SET NULL;