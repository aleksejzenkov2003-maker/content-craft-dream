
# Комплексный план улучшений UI/UX

## Статус реализации

### ✅ Завершено

#### Фаза 1: Экран «Вопросы» (Questions)
- [x] **1.1 Inline-редактирование даты** — добавлен datetime picker с выбором времени
- [x] **1.2 Массовые действия** — добавлена массовая установка даты публикации
- [x] **1.3 Объединение RU/EN** — колонки объединены, EN доступен по hover

#### Фаза 4: Экран «Канбан публикаций» (Kanban)
- [x] **4.1 Drag&drop с изменением статуса** — колонки по статусам с перетаскиванием
- [x] **4.2 Быстрые действия** — кнопки "Опубликовать" и "Повторить"
- [x] **4.3 Отображение ошибок** — tooltip с текстом ошибки

#### Фаза 2: Экран «Ролики» (Videos) — частично
- [x] **2.6 Каналы публикации** — чекбоксы каналов с автосохранением в selected_channels
- [x] **2.7 Дедубликация публикаций** — проверка video_id + channel_id перед созданием

#### Фаза 3: Экран «Публикации» (Publications)
- [x] **3.1 Массовая установка даты** — bulk date picker dialog
- [x] **3.2 Редактор публикации** — PublicationEditDialog с текстом, датой, статусом
- [x] **3.3 Дедубликация при импорте** — пропуск существующих пар video+channel

#### Фаза 6: Экран «Задние обложки» (Back Covers)
- [x] **6.1 Привязка к каналам** — миграция + рефакторинг BackCoversGrid

---

### 🔄 В работе

#### Фаза 2: Экран «Ролики» (Videos)
- [ ] **2.1 Разделение генерации** — первичная/повторная генерация
- [ ] **2.2 Варианты обложек/видео** — требуется миграция
- [ ] **2.3 Галерея вариантов** — VariantsGallery.tsx
- [ ] **2.4 Редактируемый промпт** — inline-edit cover_prompt
- [ ] **2.5 Статусы с ошибками** — tooltip с error_message

#### Фаза 5: Экран «Сцены» (Scenes)
- [ ] **5.2 Варианты сцен** — требуется миграция
- [ ] **5.3 Reject с комментарием** — rejection_reason

#### Сквозные задачи
- [ ] **S.1 Унификация кнопок** — variants в button.tsx
- [ ] **S.2 Иконки удаления** — единый стиль
- [ ] **S.3 Gemini API** — интеграция для генерации

---

## Выполненные миграции

```sql
-- ✅ Фаза 2.6: Выбранные каналы для ролика
ALTER TABLE videos ADD COLUMN selected_channels uuid[] DEFAULT '{}';

-- ✅ Фаза 6.1: Back covers для каналов
ALTER TABLE publishing_channels ADD COLUMN back_cover_url text;
ALTER TABLE publishing_channels ADD COLUMN back_cover_video_url text;
```

---

## Оставшиеся миграции

```sql
-- Фаза 2.2: Варианты обложек и видео
CREATE TABLE cover_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE video_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Фаза 2.5: Ошибки генерации
ALTER TABLE videos ADD COLUMN cover_error_message text;
ALTER TABLE videos ADD COLUMN video_error_message text;

-- Фаза 5.3: Комментарий отклонения сцены
ALTER TABLE playlist_scenes ADD COLUMN rejection_reason text;

-- Фаза 5.2: Варианты сцен
CREATE TABLE scene_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES playlist_scenes(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## Порядок реализации (оставшееся)

| Приоритет | Фаза | Описание | Сложность |
|-----------|------|----------|-----------|
| 1 | 2.2, 2.3 | Варианты обложек/видео + галерея | Высокая |
| 2 | 2.5 | Статусы с ошибками | Низкая |
| 3 | 5.2, 5.3 | Варианты сцен + reject комментарий | Средняя |
| 4 | S.1, S.2 | Унификация UI | Низкая |
| 5 | S.3 | Gemini API интеграция | Средняя |
