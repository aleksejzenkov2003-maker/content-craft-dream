
CREATE TABLE public.video_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  heygen_video_id text,
  heygen_video_url text,
  reduced_video_url text,
  video_path text,
  is_active boolean DEFAULT false,
  generation_number integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to video_variants" ON public.video_variants FOR ALL USING (true) WITH CHECK (true);
