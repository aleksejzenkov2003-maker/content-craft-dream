
# План: Импорт данных и расширение структуры базы данных

## Обзор

На основе загруженных CSV файлов из Airtable необходимо:
1. Расширить схему базы данных для поддержки всех полей
2. Добавить недостающие плейлисты
3. Обновить каналы публикации
4. Импортировать ролики с ответами духовников
5. Импортировать сцены плейлистов
6. Создать публикации

---

## Часть 1: Миграция базы данных

### 1.1 Добавить новые поля в таблицу `videos`

```sql
-- Новые поля для вопросов
ALTER TABLE videos ADD COLUMN IF NOT EXISTS question_rus text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS question_eng text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS hook_rus text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS hook_eng text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS relevance_score integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS question_status text DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS voiceover_url text;
```

### 1.2 Добавить новые плейлисты

В базе есть: Prayer & God, Faith & Doubt, Life & Death, Love & Compassion, Purpose & Meaning, Relationships, Self-Discovery, Ethics & Morality

Нужно добавить из CSV (Grid_view_3.csv):
- Family & Kids
- What's The Point?
- Sex & Desire
- Abortion: Life vs Choice
- LGBTQ+ & Identity
- Violence & Revenge
- Death & Beyond
- Love & Heartbreak
- Addiction & Temptation
- Social Media & Tech
- Betrayal & Divorce
- Sin & Forgiveness
- Work & Career
- Body & Beauty
- Suicide & Despair
- Money & Greed

### 1.3 Обновить publishing_channels

Добавить недостающие поля (уже есть: network_type, proxy_server, post_text_prompt, location):
- Нужно обновить данные из Grid_view_4.csv

---

## Часть 2: Импорт данных

### 2.1 Маппинг данных из CSV

**Grid_view.csv (Вопросы)**:
```
ID Вопроса → question_id
Актуальность → relevance_score
Planned publication date → publication_date
Безопасность вопроса → safety_score
Статус вопроса → question_status
Вопрос к духовнику eng → question_eng (или question)
Вопрос к духовнику рус → question_rus
Плейлист eng → playlist (по имени → playlist_id)
Хук eng → hook
Хук рус → hook_rus (новое поле)
```

**Аудио_и_видео.csv (Ролики)**:
```
ID Ролика → video_number
Духовник → advisor_id (по имени)
Безопасность вопроса → safety_score
Плейлист → playlist_id (по имени)
Ответ духовника → advisor_answer
Video (URL) → heygen_video_url
Video status → generation_status
Озвучка → voiceover_url (новое поле)
```

**Grid_view_2.csv (Сцены)**:
```
Духовник → advisor_id
Плейлист → playlist_id
Status → status
Промт для сцены → scene_prompt
Фото сцены → scene_url
Статус проверки → (новое поле review_status)
```

**Grid_view_4.csv (Каналы публикации)**:
```
Network Name → name
Social Network type → network_type
Proxy Server → proxy_server (или location)
Prompt для публикации → post_text_prompt
```

**Grid_view_1.csv (Публикации)**:
```
Post ID → (игнорировать, генерируется автоматически)
ID Ролика → video_id (по video_number)
Каналы публикаций → channel_id (по имени)
Network → network_type
Post date → post_date
Status → publication_status
```

### 2.2 Добавить review_status в playlist_scenes

```sql
ALTER TABLE playlist_scenes ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'Waiting';
```

---

## Часть 3: Обновление импорта в UI

### 3.1 Обновить VideoImportDialog

Расширить COLUMN_MAPPING для поддержки новых полей из CSV:
- `id ролика` → video_number
- `ответ духовника` → advisor_answer
- `озвучка` → voiceover_url
- `безопасность вопроса` → safety_score

### 3.2 Создать SceneImportDialog (новый)

Компонент для импорта сцен из CSV с маппингом:
- Духовник → advisor_id
- Плейлист → playlist_id
- Промт → scene_prompt
- Фото → scene_url
- Статус → review_status

### 3.3 Создать ChannelImportDialog (новый)

Компонент для импорта каналов публикации

---

## Часть 4: Порядок импорта данных

```text
1. Добавить плейлисты (Grid_view_3.csv)
   ↓
2. Добавить/обновить каналы публикации (Grid_view_4.csv)
   ↓
3. Импортировать ролики (Аудио_и_видео.csv)
   ↓
4. Импортировать сцены (Grid_view_2.csv)
   ↓
5. Создать публикации (Grid_view_1.csv)
```

---

## Часть 5: Обновление QuestionsTable

### 5.1 Добавить новые столбцы

На основе скриншота (image-4.png) таблица вопросов должна показывать:
- ID (question_id)
- Безопасность (safety_score) - с бейджем
- Актуальность (relevance_score) - с прогресс-баром
- Вопрос (рус) (question_rus или question)
- Дата публикации (publication_date)

### 5.2 Обновить QuestionSidePanel

Добавить поля:
- question_rus / question_eng
- hook_rus / hook_eng
- relevance_score
- question_status (checked/unchecked)

---

## Технические детали

### Миграция базы данных

```sql
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
```

### Файлы для изменения

1. **Миграция БД** - добавить поля
2. `src/hooks/useVideos.ts` - добавить новые поля в интерфейс Video
3. `src/components/questions/QuestionsTable.tsx` - обновить столбцы
4. `src/components/questions/QuestionSidePanel.tsx` - добавить поля
5. `src/components/videos/VideoImportDialog.tsx` - расширить маппинг
6. `src/components/scenes/ScenesMatrix.tsx` - добавить review_status

### Новые файлы

1. `src/components/import/DataImportWizard.tsx` - мастер импорта с шагами

---

## Порядок реализации

1. **Миграция БД** - добавить новые поля и плейлисты
2. **Обновить useVideos** - добавить новые поля в интерфейс
3. **Обновить QuestionsTable** - новые столбцы (актуальность, вопрос рус)
4. **Обновить QuestionSidePanel** - редактирование новых полей
5. **Расширить VideoImportDialog** - маппинг для Аудио_и_видео.csv
6. **Добавить импорт сцен** - в ScenesMatrix или отдельный диалог
