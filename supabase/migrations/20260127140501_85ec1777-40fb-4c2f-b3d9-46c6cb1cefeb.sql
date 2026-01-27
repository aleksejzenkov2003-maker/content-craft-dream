-- Add unique constraint on name for publishing_channels
-- This is needed for upsert operations during CSV import
ALTER TABLE public.publishing_channels ADD CONSTRAINT publishing_channels_name_unique UNIQUE (name);