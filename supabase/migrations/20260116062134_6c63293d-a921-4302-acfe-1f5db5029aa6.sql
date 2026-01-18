-- Add title field to voiceovers table for custom naming
ALTER TABLE public.voiceovers ADD COLUMN IF NOT EXISTS title text;