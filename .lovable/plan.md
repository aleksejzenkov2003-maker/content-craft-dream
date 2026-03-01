

## Задние обложки как видео + склейка с роликами

### Текущая ситуация
- `BackCoversGrid` использует `ImageInput` и `<img>` для задних обложек — только изображения
- Поле `back_cover_video_url` в `publishing_channels` уже существует, но UI не позволяет загружать видео с компьютера
- Склейка видео (main + back cover) по каналу не реализована

### Логика из n8n JSON
Workflow использует ffmpeg для склейки чанков видео:
```text
ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4
```
По аналогии, для каждой публикации нужно: **основной ролик + задняя обложка канала → итоговое видео**

### План

#### 1. UI: BackCoversGrid — загрузка видео вместо изображений
- Заменить `ImageInput` на `FileUploader` с `accept="video/*"` (mp4, mov, webm, avi)
- В карточках каналов заменить `<img>` на `<video>` с превью
- В диалоге добавления — drag-and-drop загрузка видео файлов
- Сохранять в `back_cover_video_url` (уже есть в БД)
- Фильтрация каналов: проверять `back_cover_video_url` вместо `back_cover_url`

#### 2. Edge Function: `concat-video` — склейка через n8n
- Создать edge function `concat-video`, которая:
  - Принимает `video_url` (основной ролик) и `back_cover_video_url` (задняя обложка канала)
  - Отправляет запрос на n8n инстанс (seintn8n.duckdns.org) с заданием на склейку через ffmpeg
  - Получает результат и загружает в storage
  - Обновляет публикацию с финальным URL
- Нужен секрет `N8N_WEBHOOK_URL` для вызова n8n

#### 3. Интеграция склейки в процесс публикации
- При публикации видео на канал: если у канала есть `back_cover_video_url`, вызвать `concat-video`
- Результат склейки сохранять в публикацию (новое поле `final_video_url` в `publications`)
- Показывать статус склейки в таблице публикаций

#### 4. Файлы для изменения
- `src/components/covers/BackCoversGrid.tsx` — видео вместо изображений
- `supabase/functions/concat-video/index.ts` — новая edge function
- `src/components/publishing/PublicationsTable.tsx` — статус склейки
- Миграция: добавить `final_video_url` в `publications`

### Вопрос
Нужно уточнить: использовать ваш n8n инстанс (seintn8n.duckdns.org) для ffmpeg склейки, или реализовать другой подход?

