-- Create table for caching HeyGen avatars
CREATE TABLE public.heygen_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id TEXT UNIQUE NOT NULL,
  avatar_name TEXT NOT NULL,
  preview_image_url TEXT,
  preview_video_url TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.heygen_avatars ENABLE ROW LEVEL SECURITY;

-- Allow public read access (avatars are not sensitive)
CREATE POLICY "Allow public read access to heygen_avatars"
ON public.heygen_avatars
FOR SELECT
USING (true);

-- Allow all operations for authenticated users (for cache updates via edge functions)
CREATE POLICY "Allow all access to heygen_avatars"
ON public.heygen_avatars
FOR ALL
USING (true)
WITH CHECK (true);