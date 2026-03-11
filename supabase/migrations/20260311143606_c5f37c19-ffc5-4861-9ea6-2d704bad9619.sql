
create table public.automation_settings (
  id uuid primary key default gen_random_uuid(),
  button_key text not null,
  process_key text not null,
  process_label text not null default '',
  is_enabled boolean not null default true,
  created_at timestamptz default now(),
  unique(button_key, process_key)
);

alter table public.automation_settings enable row level security;

create policy "Allow all access to automation_settings"
on public.automation_settings for all
to public
using (true)
with check (true);

-- Seed: Взят в работу
insert into public.automation_settings (button_key, process_key, process_label) values
  ('take_in_work', 'voiceover', 'Генерация аудио и субтитров'),
  ('take_in_work', 'atmosphere', 'Генерация фона для обложки'),
  ('take_in_work', 'cover_overlay', 'Склейка обложки с миниатюрой + заголовок'),
  ('take_in_work', 'heygen', 'Генерация видео в HeyGen'),
  ('take_in_work', 'resize', 'Уменьшение размера видео'),
  ('take_in_work', 'subtitles', 'Наложение субтитров на видео');

-- Seed: Генерация видео
insert into public.automation_settings (button_key, process_key, process_label) values
  ('generate_video', 'heygen', 'Генерация видео в HeyGen'),
  ('generate_video', 'resize', 'Уменьшение размера видео'),
  ('generate_video', 'subtitles', 'Финальное видео с субтитрами');

-- Seed: Подготовка к публикации
insert into public.automation_settings (button_key, process_key, process_label) values
  ('prepare_publish', 'create_publication', 'Добавление задачи на публикацию'),
  ('prepare_publish', 'concat', 'Добавление задней обложки'),
  ('prepare_publish', 'generate_text', 'Генерация текста описания'),
  ('prepare_publish', 'publish_social', 'Публикация в соцсетях');

-- Seed: Опубликовать
insert into public.automation_settings (button_key, process_key, process_label) values
  ('publish', 'publish_social', 'Публикация в соцсетях');
