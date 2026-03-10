CREATE TABLE public.scene_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES public.playlist_scenes(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  prompt_used text,
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scene_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for scene_variants" ON public.scene_variants FOR ALL USING (true) WITH CHECK (true);