
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
- [x] **2.7 Дедубликация публикаций** — проверка video_id + channel_id перед созданием

#### Фаза 3: Экран «Публикации» (Publications)
- [x] **3.1 Массовая установка даты** — bulk date picker dialog
- [x] **3.2 Редактор публикации** — PublicationEditDialog с текстом, датой, статусом
- [x] **3.3 Дедубликация при импорте** — пропуск существующих пар video+channel

---

## Обзор

Это масштабный план улучшений по 6 экранам + сквозные задачи. Все задачи разбиты на фазы с приоритетом от высокого к низкому.

---

## Фаза 1: Экран «Вопросы» (Questions) ✅ ЗАВЕРШЕНО

### 1.1 Inline-редактирование даты ✅
**Задача:** Добавить date-time picker прямо в колонку «Дата»
**Статус:** Реализовано с выбором времени (часы/минуты)

### 1.2 Массовые действия ✅
**Добавлено:** Массовая установка даты публикации + генерация обложек

### 1.3 Разделение RU/EN ✅
**Задача:** Основная колонка показывает RU, EN доступен по hover/expand
**Статус:** Реализовано через HoverCard

**Изменения:**
- `src/components/questions/QuestionsTable.tsx` — объединить вопрос RU/EN в одну колонку с hover-preview для EN

### 1.4 Улучшение импорта CSV
**Текущее состояние:** Базовый импорт  
**Добавить:**
- Режимы импорта: «добавить новые» / «обновить существующие» / «пропустить дубликаты»
- Валидации: проверка обязательных полей, формата даты

**Изменения:**
- `src/components/import/CsvImporter.tsx` — добавить dropdown для выбора режима
- Добавить валидацию строк перед импортом

### 1.5 Изменение ширины колонок (resize)
**Задача:** Перетаскивание границ колонок  
**Реализация:** Добавить react-resizable-panels или custom resize handlers

**Изменения:**
- Создать `src/components/ui/resizable-table.tsx` — компонент таблицы с ресайзом
- Применить к QuestionsTable

---

## Фаза 2: Экран «Ролики» (Videos)

### 2.1 Разделение генерации на первичную/повторную
**Текущее состояние:** Одна кнопка "Generate"  
**Задача:** 
- Если пусто → "Создать"
- Если есть варианты → "Новый вариант"

**Изменения:**
- `src/components/videos/VideosTable.tsx` — логика отображения разных кнопок
- Добавить счетчик вариантов

### 2.2 Хранение нескольких вариантов обложек/видео
**Требуется миграция БД:**
```sql
CREATE TABLE cover_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id),
  image_url text NOT NULL,
  prompt text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE video_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id),
  video_url text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Изменения:**
- Создать хуки `useCoverVariants`, `useVideoVariants`
- UI компонент галереи вариантов

### 2.3 Просмотр/выбор вариантов
**Задача:** Клик по превью → галерея вариантов

**Изменения:**
- Создать `src/components/videos/VariantsGallery.tsx` — модалка с превью, выбором активного, удалением

### 2.4 Редактируемый промпт + Regenerate
**Текущее состояние:** Промпт в боковой панели  
**Задача:** Показать промпт прямо в карточке/строке с кнопкой регенерации

**Изменения:**
- `src/components/videos/VideosTable.tsx` — добавить inline-edit для cover_prompt

### 2.5 Статусы: единая модель
**Задача:** `pending | generating | ready | error` для обоих (cover/video)
**Ошибки:** tooltip/диалог с error_message

**Изменения:**
- Добавить колонку `cover_error_message`, `video_error_message` в videos (миграция)
- UI: красный индикатор + tooltip с текстом ошибки

### 2.6 Каналы публикации внутри ролика
**Задача:** Чекбоксы каналов как в Airtable

**Изменения:**
- `src/components/videos/VideoSidePanel.tsx` — добавить секцию с мультиселектом каналов
- Сохранять выбранные каналы в новую колонку `selected_channels uuid[]` (миграция)

### 2.7 Дедубликация публикаций
**Задача:** Проверять пару video_id + channel_id перед созданием

**Изменения:**
- `src/hooks/usePublications.ts` → `addPublication` — проверять существование
- Показывать уведомление если дубль

---

## Фаза 3: Экран «Публикации» (Publications)

### 3.1 Массовые действия (уже есть частично)
**Добавить:**
- Set date/time (массовая установка даты)

**Изменения:**
- `src/components/publishing/PublicationsTable.tsx` — добавить date picker dialog

### 3.2 Редактирование внутри публикации
**Текущее состояние:** Нет редактирования текста  
**Задача:** Клик → диалог редактирования

**Изменения:**
- Создать `src/components/publishing/PublicationEditDialog.tsx`
- Поля: текст, дата/время, статус

### 3.3 Дедубликация при импорте
**Изменения:**
- `src/hooks/usePublications.ts` → `bulkImport` — использовать upsert с conflict на `(video_id, channel_id)`

---

## Фаза 4: Экран «Канбан публикаций» (Kanban)

### 4.1 Drag&drop с изменением статуса
**Текущее состояние:** DnD подготовлен, но `handleDragEnd` пустой

**Изменения:**
- `src/components/publishing/PublishingKanban.tsx`:
  - Реструктурировать на колонки по статусам (не по каналам)
  - `handleDragEnd` → вызывать `updatePublication(id, { publication_status })`

### 4.2 Быстрые действия на карточке
**Добавить:**
- Кнопка "Опубликовать"
- Кнопка "Открыть лог ошибки"

**Изменения:**
- `KanbanCard` — добавить кнопки + tooltip с error_message

### 4.3 Редактирование даты по клику
**Изменения:**
- Добавить inline date-picker в карточку

### 4.4 Визуальная иерархия группировок
**Задача:** Отступы/фон для уровней группировки

**Изменения:**
- CSS стили для вложенных групп

---

## Фаза 5: Экран «Сцены» (Scenes)

### 5.1 Кнопка Generate на строку
**Текущее состояние:** Уже есть (Wand2 icon)  
**Статус:** ✅ Готово

### 5.2 Хранение нескольких вариантов сцен
**Миграция:**
```sql
CREATE TABLE scene_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES playlist_scenes(id),
  image_url text NOT NULL,
  prompt text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### 5.3 Approve/Reject с комментарием
**Текущее состояние:** Есть approve/reject кнопки  
**Добавить:** Поле комментария при reject

**Изменения:**
- `src/components/scenes/SceneSidePanel.tsx` — добавить textarea для комментария
- Колонка `rejection_reason text` в playlist_scenes (миграция)

---

## Фаза 6: Экран «Задние обложки» (Back Covers)

### 6.1 Привязка к каналу вместо духовника
**КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ:** Сейчас привязано к advisors.back_cover_template_url

**Миграция:**
```sql
ALTER TABLE publishing_channels ADD COLUMN back_cover_url text;
ALTER TABLE publishing_channels ADD COLUMN back_cover_video_url text;
```

**Изменения:**
- Перестроить `src/components/covers/BackCoversGrid.tsx`:
  - Группировка по каналам
  - Загрузка/генерация для каждого канала

### 6.2 Хранение вариантов back cover
**Миграция:**
```sql
CREATE TABLE back_cover_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES publishing_channels(id),
  image_url text,
  video_url text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## Сквозные задачи

### S.1 Единый компонент кнопок
**Текущее состояние:** Разные стили  
**Задача:** Стандартизировать variants в `src/components/ui/button.tsx`

**Добавить variants:**
- `generate-cover` (оранжевый)
- `generate-video` (фиолетовый)  
- `publish` (синий)
- `danger` (красный)

### S.2 Иконка удаления
**Задача:** Один крестик вместо двойного
**Изменения:** Проверить все места с Trash2/X иконками

### S.3 Gemini API вместо тестового генератора
**Текущее состояние:** Edge functions используют разные подходы  
**Задача:** Унифицировать на Lovable AI (gemini-2.5-flash-image для изображений)

**Изменения:**
- `supabase/functions/generate-cover/index.ts` — использовать Lovable AI
- `supabase/functions/generate-scene/index.ts` — использовать Lovable AI

---

## Порядок реализации

| Приоритет | Фаза | Описание | Сложность |
|-----------|------|----------|-----------|
| 1 | 1.1, 1.2 | Вопросы: inline даты + массовые действия | Низкая |
| 2 | 4.1 | Канбан: drag&drop со сменой статуса | Средняя |
| 3 | 2.6, 2.7 | Ролики: каналы + дедубликация | Средняя |
| 4 | 3.1, 3.2 | Публикации: массовые действия + редактор | Средняя |
| 5 | 6.1 | Back covers: привязка к каналам | Высокая (миграция) |
| 6 | 2.2, 2.3 | Варианты обложек/видео | Высокая (миграция) |
| 7 | S.1, S.2 | Унификация UI | Низкая |
| 8 | S.3 | Gemini API интеграция | Средняя |

---

## Миграции БД (сводка)

```sql
-- Фаза 2: Варианты обложек и видео
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

-- Фаза 2: Ошибки генерации
ALTER TABLE videos ADD COLUMN cover_error_message text;
ALTER TABLE videos ADD COLUMN video_error_message text;

-- Фаза 2: Выбранные каналы для ролика
ALTER TABLE videos ADD COLUMN selected_channels uuid[] DEFAULT '{}';

-- Фаза 5: Комментарий отклонения сцены
ALTER TABLE playlist_scenes ADD COLUMN rejection_reason text;

-- Фаза 5: Варианты сцен
CREATE TABLE scene_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES playlist_scenes(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Фаза 6: Back covers для каналов
ALTER TABLE publishing_channels ADD COLUMN back_cover_url text;
ALTER TABLE publishing_channels ADD COLUMN back_cover_video_url text;

CREATE TABLE back_cover_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES publishing_channels(id) ON DELETE CASCADE,
  image_url text,
  video_url text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## Новые компоненты

1. `src/components/ui/inline-edit.tsx` — расширить datetime picker
2. `src/components/videos/VariantsGallery.tsx` — галерея вариантов
3. `src/components/publishing/PublicationEditDialog.tsx` — редактор публикации
4. `src/components/ui/resizable-table.tsx` — таблица с ресайзом колонок

---

## Новые хуки

1. `src/hooks/useCoverVariants.ts`
2. `src/hooks/useVideoVariants.ts`
3. `src/hooks/useSceneVariants.ts`
4. `src/hooks/useBackCoverVariants.ts`

