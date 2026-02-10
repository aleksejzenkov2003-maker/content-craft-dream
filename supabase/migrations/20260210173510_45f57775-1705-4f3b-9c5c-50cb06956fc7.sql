
-- Add default_channels field to advisors table for pre-filling publication channels
ALTER TABLE public.advisors ADD COLUMN default_channels text[] DEFAULT NULL;
