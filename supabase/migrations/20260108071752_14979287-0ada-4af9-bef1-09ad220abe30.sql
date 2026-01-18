-- Create voiceovers table
CREATE TABLE public.voiceovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rewritten_content_id UUID REFERENCES public.rewritten_content(id) ON DELETE CASCADE,
  audio_url TEXT,
  audio_source TEXT CHECK (audio_source IN ('elevenlabs', 'recorded', 'uploaded')),
  duration_seconds INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voiceovers ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now since no auth)
CREATE POLICY "Allow all operations on voiceovers" ON public.voiceovers FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_voiceovers_rewritten_content_id ON public.voiceovers(rewritten_content_id);
CREATE INDEX idx_voiceovers_status ON public.voiceovers(status);

-- Create trigger for updated_at
CREATE TRIGGER update_voiceovers_updated_at
  BEFORE UPDATE ON public.voiceovers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for voiceovers
INSERT INTO storage.buckets (id, name, public) VALUES ('voiceovers', 'voiceovers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Voiceover audio is publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'voiceovers');
CREATE POLICY "Anyone can upload voiceover audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voiceovers');
CREATE POLICY "Anyone can update voiceover audio" ON storage.objects FOR UPDATE USING (bucket_id = 'voiceovers');
CREATE POLICY "Anyone can delete voiceover audio" ON storage.objects FOR DELETE USING (bucket_id = 'voiceovers');