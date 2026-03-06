

## Аудит пайплайна генерации роликов и текстов для соц. сетей

### Найденные проблемы

**1. `generate-cover` — использует `is_primary` вместо `thumbnail_photo_id`**
Обложка накладывает фото советника поверх атмосферы. Сейчас ищет фото по `is_primary`, но мы добавили поле `thumbnail_photo_id` на таблицу `advisors` специально для этого. Нужно:
- Запросить `advisors (id, name, display_name, thumbnail_photo_id)` в запросе видео
- Если `thumbnail_photo_id` есть — получить `photo_url` по этому ID
- Фоллбэк на `is_primary` если `thumbnail_photo_id` не задан

**2. `generate-video-heygen` — фоллбэк фото использует `is_primary` вместо `scene_photo_id`**
Когда нет playlist scene, функция ищет фото советника для HeyGen. Должна использовать `scene_photo_id`:
- Запросить `advisors (id, name, display_name, elevenlabs_voice_id, scene_photo_id)` 
- Если `scene_photo_id` есть — получить `photo_url` по ID
- Фоллбэк на `is_primary` если не задано

**3. `generate-post-text` — мёртвый код и отсутствующие переменные**
- Строки 126-132: `if/else` делает одно и то же (мёртвый код) — убрать
- Отсутствуют полезные переменные `{{channel}}` и `{{network_type}}` для кастомизации текста под конкретную соцсеть
- Добавить подстановку `{{video_title}}`

**4. Пайплайн в целом — корректен**
- `generate-voiceover-for-video` ✅ — правильно берёт `advisor_answer`, правильный voice ID
- `generate-scene` ✅ — правильно использует промпт из БД с переменными
- `check-video-status` ✅ — правильно поллит HeyGen, автоматически маркирует публикации для concat
- `concat-video` ✅ — MP4 atom-level конкатенация
- `useVideoGeneration` ✅ — polling каждые 10 сек
- `usePublications` ✅ — автогенерация текста при создании, дедубликация

### Файлы для изменения

| Файл | Изменение |
|---|---|
| `supabase/functions/generate-cover/index.ts` | Использовать `thumbnail_photo_id` вместо `is_primary` |
| `supabase/functions/generate-video-heygen/index.ts` | Использовать `scene_photo_id` вместо `is_primary` в фоллбэке |
| `supabase/functions/generate-post-text/index.ts` | Убрать мёртвый код, добавить `{{channel}}`, `{{network_type}}`, `{{video_title}}` |

### Подход

В каждой Edge Function: расширить `select` запрос чтобы включить новые поля advisor, затем сначала искать фото по ID, при отсутствии — фоллбэк на `is_primary`.

