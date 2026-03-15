

## Интеграция Upload-Post.com для публикации видео

### Суть
Добавляем систему постинга через Upload-Post.com API (`POST https://api.upload-post.com/api/upload`). Настройка привязки к Upload-Post делается в карточке канала — указывается `user` (профиль в Upload-Post). API ключ хранится глобально как секрет. При публикации edge function отправляет видео по URL + текст поста на нужную платформу.

### Upload-Post API (ключевое)

```text
POST https://api.upload-post.com/api/upload
Header: Authorization: Apikey <UPLOAD_POST_API_KEY>

Обязательные параметры (multipart/form-data):
  - user: string (идентификатор профиля в Upload-Post)
  - platform[]: array (tiktok, instagram, youtube, facebook, twitter, threads, pinterest, bluesky, reddit)
  - video: File или URL

Опциональные:
  - title: string (текст поста / caption)
  - description: string (для YouTube/LinkedIn)
  - scheduled_date: ISO-8601 (планирование)
  - async_upload: boolean
  - cover_url: string (для Instagram)
  - thumbnail_url: string (для YouTube)

Ответ (200): { success, results: { platform: { success, url } } }
Ответ (200 async): { success, request_id }

Статус: GET /api/uploadposts/status?request_id=...
```

### Маппинг network_type → platform
```text
instagram → instagram
tiktok    → tiktok
youtube   → youtube
facebook  → facebook
website   → пропускается (существующий upload-to-website)
```

### Изменения

**1. Секрет: `UPLOAD_POST_API_KEY`**
- Запросить у пользователя API ключ Upload-Post через `add_secret`

**2. Поле `upload_post_user` в `publishing_channels`**
- Migration: `ALTER TABLE publishing_channels ADD COLUMN upload_post_user TEXT DEFAULT NULL;`
- Это имя профиля в Upload-Post, привязанного к этому каналу

**3. UI: `PublishingChannelsGrid.tsx` — форма канала**
- Добавить поле "Upload-Post профиль" (Input) в диалог редактирования
- Сохранять в `upload_post_user`
- Показывать бейдж на карточке если заполнено

**4. Edge Function: `publish-to-social` (новая)**
- Принимает `publicationId`
- Загружает publication + video + channel
- Определяет video URL (final_video_url → video_path → heygen_video_url)
- Маппит `network_type` → `platform[]`
- Отправляет `POST` к `https://api.upload-post.com/api/upload` с form-data:
  - `user` = channel.upload_post_user
  - `platform[]` = маппинг от network_type
  - `video` = video URL (Upload-Post принимает URL)
  - `title` = publication.generated_text
  - `cover_url` = video.front_cover_url (для Instagram)
  - `thumbnail_url` = video.front_cover_url (для YouTube)
  - `async_upload` = true
- Сохраняет `request_id` в `publications.post_url` (временно) или в error_message
- Обновляет `publication_status` → `published` или `error`
- Логирует в `activity_log`

**5. Интеграция в publish flow: `Index.tsx`**
- В `handlePublishVideo`: для каналов с `network_type` !== 'website' и у которых есть `upload_post_user` — вызывать `publish-to-social` вместо/после concat
- Добавить в automation_settings процесс `publish_social` уже существует — используем его

**6. UI публикации: кнопка "Опубликовать" в PublicationsTable / PublishingKanban**
- Существующая кнопка "Опубликовать" для non-website каналов вызывает `publish-to-social`

**7. Hook: `usePublishingChannels.ts`**
- Добавить `upload_post_user` в интерфейс `PublishingChannel`

### Не меняется
- Логика `upload-to-website` для каналов `network_type: website`
- Генерация текста, concat, обложки

