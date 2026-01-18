-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for media-files bucket
CREATE POLICY "Anyone can view media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-files');

CREATE POLICY "Anyone can upload media files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media-files');

CREATE POLICY "Anyone can update media files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'media-files');

CREATE POLICY "Anyone can delete media files"
ON storage.objects FOR DELETE
USING (bucket_id = 'media-files');

-- Extend activity_log with detailed data
ALTER TABLE public.activity_log 
ADD COLUMN IF NOT EXISTS input_data jsonb,
ADD COLUMN IF NOT EXISTS output_data jsonb,
ADD COLUMN IF NOT EXISTS duration_ms integer,
ADD COLUMN IF NOT EXISTS tokens_used integer,
ADD COLUMN IF NOT EXISTS cost_estimate numeric,
ADD COLUMN IF NOT EXISTS step_number integer,
ADD COLUMN IF NOT EXISTS parent_entity_id uuid;

-- Create prompt_history table for versioning
CREATE TABLE IF NOT EXISTS public.prompt_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  system_prompt text NOT NULL,
  user_template text NOT NULL,
  model text NOT NULL,
  temperature numeric NOT NULL,
  max_tokens integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  change_note text
);

-- Enable RLS on prompt_history
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to prompt_history"
ON public.prompt_history FOR ALL
USING (true)
WITH CHECK (true);

-- Add custom file fields to video_projects
ALTER TABLE public.video_projects
ADD COLUMN IF NOT EXISTS custom_script_url text,
ADD COLUMN IF NOT EXISTS custom_audio_url text,
ADD COLUMN IF NOT EXISTS custom_video_url text,
ADD COLUMN IF NOT EXISTS audio_source text DEFAULT 'elevenlabs',
ADD COLUMN IF NOT EXISTS video_source text DEFAULT 'heygen';

-- Add manual content fields to parsed_content
ALTER TABLE public.parsed_content
ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '[]'::jsonb;