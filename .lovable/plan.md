

# Переделка "Фоновые подложки" — shared backgrounds с назначением как в промтах

## Проблема

Сейчас каждая комбинация плейлист+духовник = отдельная запись в `background_videos`. Но подложек всего ~6, и одна подложка назначается на много комбинаций. Нужна модель "создал подложку → назначил на комбинации", как в промтах. Также подложки могут быть фото (не только видео), и их нужно уметь открывать для просмотра.

## Изменения в БД

Разделить на 2 таблицы:
- **`background_videos`** — каталог подложек (id, title, media_url, media_type ['video'|'image'], created_at). Всего ~6 штук.
- **`background_assignments`** — привязки (id, background_id → background_videos.id, playlist_id, advisor_id). Много записей.

Миграция:
1. Создать `background_assignments`
2. Перенести данные из текущей `background_videos` (playlist_id, advisor_id → assignments)
3. Убрать playlist_id/advisor_id из `background_videos`, переименовать `video_url` → `media_url`, добавить `media_type text default 'video'`

## UI — `BackgroundVideosGrid.tsx` полная переделка

**Основной вид** (как на скрине 1 — сетка карточек подложек):
- Карточки подложек в grid (9:16 aspect ratio)
- Каждая карточка: название сверху, превью фото/видео, кнопка удалить
- Клик по карточке → открывает диалог редактирования/назначения
- Кнопка "Новая подложка" → диалог создания

**Диалог создания/редактирования** (как в промтах — 2 колонки):
- **Левая колонка**: Название + загрузка файла (accept="video/*,image/*")
- **Правая колонка**: Назначение на плейлисты/духовников — структура как в промтах для motion:
  - Чекбокс-список плейлистов
  - Внутри раскрытого плейлиста — чекбокс-список духовников
  - Кнопка "Назначить"

**Просмотр**: клик по превью в карточке открывает MediaPreview (уже есть компонент)

## Hook — `useBackgroundVideos.ts` переделка

- Хранить `backgrounds` (каталог) и `assignments` (привязки) отдельно
- CRUD для каталога: `addBackground`, `updateBackground`, `deleteBackground`
- CRUD для привязок: `assignBackground(backgroundId, playlistId, advisorId)`, `unassignBackground(assignmentId)`
- Метод `getBackgroundForPair(playlistId, advisorId)` — для использования в pipeline

## Файлы

- **Миграция**: новая таблица `background_assignments`, ALTER `background_videos`
- **Переделка**: `src/components/backgrounds/BackgroundVideosGrid.tsx`, `src/hooks/useBackgroundVideos.ts`
- **Мелкие правки**: `supabase/functions/generate-video-heygen/index.ts` — читать из `background_assignments` JOIN `background_videos`

