ALTER TABLE public.cover_thumbnails ADD COLUMN atmosphere_url text;
ALTER TABLE public.cover_thumbnails ADD COLUMN is_active boolean DEFAULT false;
ALTER TABLE public.cover_thumbnails ADD COLUMN variant_type text DEFAULT 'cover';
-- variant_type: 'atmosphere' or 'cover'