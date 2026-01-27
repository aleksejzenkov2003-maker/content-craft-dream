-- 1. Новые поля для videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS question_rus text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS hook_rus text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS relevance_score integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS question_status text DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS voiceover_url text;

-- 2. Новое поле для playlist_scenes
ALTER TABLE playlist_scenes ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'Waiting';

-- 3. Новые плейлисты
INSERT INTO playlists (name, description) VALUES
  ('Family & Kids', 'Семья и дети'),
  ('What''s The Point?', 'В чём смысл?'),
  ('Sex & Desire', 'Секс и желание'),
  ('Abortion: Life vs Choice', 'Аборт: Жизнь или выбор'),
  ('LGBTQ+ & Identity', 'ЛГБТ+ и идентичность'),
  ('Violence & Revenge', 'Насилие и месть'),
  ('Death & Beyond', 'Смерть и потустороннее'),
  ('Love & Heartbreak', 'Любовь и разлука'),
  ('Addiction & Temptation', 'Зависимость и искушение'),
  ('Social Media & Tech', 'Соцсети и технологии'),
  ('Betrayal & Divorce', 'Предательство и развод'),
  ('Sin & Forgiveness', 'Грех и прощение'),
  ('Work & Career', 'Работа и карьера'),
  ('Body & Beauty', 'Тело и красота'),
  ('Suicide & Despair', 'Суицид и отчаяние'),
  ('Money & Greed', 'Деньги и жадность')
ON CONFLICT (name) DO NOTHING;