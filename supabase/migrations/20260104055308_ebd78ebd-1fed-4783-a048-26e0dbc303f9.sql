-- Create enum types
CREATE TYPE public.content_source AS ENUM ('youtube', 'telegram', 'instagram', 'web');
CREATE TYPE public.content_status AS ENUM ('parsed', 'selected', 'rewriting', 'rewritten', 'voiceover', 'video', 'published');
CREATE TYPE public.video_status AS ENUM ('pending', 'voiceover', 'generating', 'editing', 'ready', 'published');

-- Channels/Sources table
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source content_source NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  posts_count INTEGER NOT NULL DEFAULT 0,
  last_parsed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Parsed content table
CREATE TABLE public.parsed_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  original_url TEXT,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_score NUMERIC(5,2) DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  parsed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status content_status NOT NULL DEFAULT 'parsed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Prompts table for storing and testing prompts
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rewrite',
  system_prompt TEXT NOT NULL,
  user_template TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
  temperature NUMERIC(2,1) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rewritten content table
CREATE TABLE public.rewritten_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parsed_content_id UUID REFERENCES public.parsed_content(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.prompts(id),
  rewritten_text TEXT NOT NULL,
  script TEXT,
  hook TEXT,
  cta TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Video projects table
CREATE TABLE public.video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rewritten_content_id UUID REFERENCES public.rewritten_content(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status video_status NOT NULL DEFAULT 'pending',
  voiceover_url TEXT,
  heygen_video_id TEXT,
  heygen_video_url TEXT,
  final_video_url TEXT,
  avatar_id TEXT,
  voice_id TEXT,
  duration INTEGER,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activity log table
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsed_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewritten_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (no auth for now)
CREATE POLICY "Allow all access to channels" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to parsed_content" ON public.parsed_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to prompts" ON public.prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to rewritten_content" ON public.rewritten_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to video_projects" ON public.video_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to activity_log" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_projects_updated_at BEFORE UPDATE ON public.video_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rewrite prompt
INSERT INTO public.prompts (name, type, system_prompt, user_template, model, temperature, max_tokens) VALUES (
  'Viral Video Script',
  'rewrite',
  'Ты опытный копирайтер для вирусного контента. Твоя задача - переписать контент в формат короткого вирусного видео с мощным хуком, ценным контентом и сильным призывом к действию.',
  'Перепиши следующий контент в формат вирусного видео скрипта (30-60 секунд):

ОРИГИНАЛ:
{{content}}

Структура ответа:
1. HOOK (первые 3 секунды - должен зацепить)
2. ОСНОВНОЙ КОНТЕНТ (ценность, факты, история)
3. CTA (призыв к действию)

Пиши живым разговорным языком.',
  'claude-sonnet-4-5',
  0.8,
  2000
);