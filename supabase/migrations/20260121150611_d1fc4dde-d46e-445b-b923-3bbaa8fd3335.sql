-- Add new fields to videos table
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS cover_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS front_cover_url text,
ADD COLUMN IF NOT EXISTS back_cover_url text,
ADD COLUMN IF NOT EXISTS video_duration integer,
ADD COLUMN IF NOT EXISTS reel_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS publication_date timestamp with time zone;

-- Add scene_prompt to playlists
ALTER TABLE public.playlists
ADD COLUMN IF NOT EXISTS scene_prompt text;

-- Add back_cover_template to advisors
ALTER TABLE public.advisors
ADD COLUMN IF NOT EXISTS back_cover_template_url text;

-- Create publishing_channels table
CREATE TABLE IF NOT EXISTS public.publishing_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  network_type text NOT NULL, -- instagram, tiktok, youtube, facebook, website
  proxy_server text,
  location text,
  api_credentials jsonb,
  post_text_prompt text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for publishing_channels
ALTER TABLE public.publishing_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to publishing_channels" ON public.publishing_channels
FOR ALL USING (true) WITH CHECK (true);

-- Create publications table
CREATE TABLE IF NOT EXISTS public.publications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.publishing_channels(id) ON DELETE CASCADE,
  post_date timestamp with time zone,
  post_url text,
  generated_text text,
  publication_status text DEFAULT 'pending', -- pending, scheduled, published, failed
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  followers integer DEFAULT 0,
  reach integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for publications
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to publications" ON public.publications
FOR ALL USING (true) WITH CHECK (true);

-- Create playlist_scenes table
CREATE TABLE IF NOT EXISTS public.playlist_scenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE CASCADE,
  scene_prompt text,
  scene_url text,
  status text DEFAULT 'waiting', -- waiting, generating, approved, cancelled
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for playlist_scenes
ALTER TABLE public.playlist_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to playlist_scenes" ON public.playlist_scenes
FOR ALL USING (true) WITH CHECK (true);

-- Create cover_thumbnails table
CREATE TABLE IF NOT EXISTS public.cover_thumbnails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  prompt text,
  front_cover_url text,
  back_cover_url text,
  status text DEFAULT 'pending', -- pending, generating, ready, failed
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for cover_thumbnails
ALTER TABLE public.cover_thumbnails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cover_thumbnails" ON public.cover_thumbnails
FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_publishing_channels_updated_at
BEFORE UPDATE ON public.publishing_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_publications_updated_at
BEFORE UPDATE ON public.publications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playlist_scenes_updated_at
BEFORE UPDATE ON public.playlist_scenes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cover_thumbnails_updated_at
BEFORE UPDATE ON public.cover_thumbnails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();