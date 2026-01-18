-- Таблица плейлистов
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  video_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Таблица духовников/аватаров
CREATE TABLE public.advisors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  speech_speed NUMERIC DEFAULT 1.0,
  elevenlabs_voice_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Таблица фото-аватаров для духовников (несколько фото на духовника)
CREATE TABLE public.advisor_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id UUID NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  heygen_asset_id TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Таблица роликов
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_number INTEGER,
  question_id INTEGER,
  advisor_id UUID REFERENCES public.advisors(id),
  playlist_id UUID REFERENCES public.playlists(id),
  safety_score TEXT,
  hook TEXT,
  question TEXT,
  answer_prompt TEXT,
  advisor_answer TEXT,
  answer_status TEXT DEFAULT 'pending',
  video_title TEXT,
  cover_prompt TEXT,
  main_photo_url TEXT,
  cover_url TEXT,
  generation_status TEXT DEFAULT 'pending',
  video_path TEXT,
  heygen_video_id TEXT,
  heygen_video_url TEXT,
  tiktok_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  facebook_url TEXT,
  pinterest_url TEXT,
  reddit_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Политики доступа (публичный доступ на чтение, полный доступ для аутентифицированных)
CREATE POLICY "Public read access for playlists" ON public.playlists FOR SELECT USING (true);
CREATE POLICY "Authenticated full access for playlists" ON public.playlists FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access for advisors" ON public.advisors FOR SELECT USING (true);
CREATE POLICY "Authenticated full access for advisors" ON public.advisors FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access for advisor_photos" ON public.advisor_photos FOR SELECT USING (true);
CREATE POLICY "Authenticated full access for advisor_photos" ON public.advisor_photos FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access for videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Authenticated full access for videos" ON public.videos FOR ALL USING (true) WITH CHECK (true);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_advisors_updated_at
  BEFORE UPDATE ON public.advisors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Триггер для обновления счетчика видео в плейлисте
CREATE OR REPLACE FUNCTION public.update_playlist_video_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.playlists SET video_count = video_count + 1 WHERE id = NEW.playlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.playlists SET video_count = video_count - 1 WHERE id = OLD.playlist_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.playlist_id IS DISTINCT FROM NEW.playlist_id THEN
    IF OLD.playlist_id IS NOT NULL THEN
      UPDATE public.playlists SET video_count = video_count - 1 WHERE id = OLD.playlist_id;
    END IF;
    IF NEW.playlist_id IS NOT NULL THEN
      UPDATE public.playlists SET video_count = video_count + 1 WHERE id = NEW.playlist_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_playlist_count
  AFTER INSERT OR DELETE OR UPDATE OF playlist_id ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_playlist_video_count();