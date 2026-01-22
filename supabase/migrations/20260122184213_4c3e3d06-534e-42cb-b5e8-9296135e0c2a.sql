-- Add question_eng field to videos table for English translation
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS question_eng TEXT;