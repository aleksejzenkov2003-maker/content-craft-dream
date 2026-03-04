

## Проблемы и план исправлений

### Проблема 1: Данные не передаются в промты публикаций

**Причина**: В `usePublications.ts` запрос к базе не включает ключевые поля из таблицы `videos`, которые нужны для заполнения переменных промта:

```
// Текущий запрос (строки 60-68):
video:videos (
  id, video_title, question, advisor_id, 
  video_number, video_duration,
  advisor:advisors (id, name, display_name)
)
channel:publishing_channels (id, name, network_type)
```

**Отсутствуют**:
- `hook` — для `{{hook}}`
- `advisor_answer` — для `{{answer}}`
- `voiceover_url` — для аудиоплеера в диалоге
- `post_text_prompt` — в `publishing_channels` для подтягивания промпта канала

Из-за этого шаблон промта выглядит как на скриншоте: `Хук:` (пусто), `Ответ духовника:` (пусто).

Также в `Publication` интерфейсе (строки 22-33) у `video` нет полей `hook`, `advisor_answer`, `voiceover_url`.

### Проблема 2: Склейка видео не работает

**Причина**: Склейка использует `ffmpeg.wasm` в браузере (`useVideoConcat.ts`). Вероятная проблема — CORS при загрузке видео через `fetchFile()`. Файлы с HeyGen (`heygen_video_url`) и с back_cover_video_url — внешние URL, которые блокируются CORS в браузере.

Также в `publishing_channels` запрос не включает `back_cover_video_url`, поэтому `requiresConcat()` и `handleConcat()` всегда считают что у канала нет обложки.

---

### План изменений

#### 1. Исправить запрос в `usePublications.ts`

Добавить недостающие поля в select:
```
video:videos (
  id, video_title, question, advisor_id, 
  video_number, video_duration,
  hook, advisor_answer, voiceover_url,
  advisor:advisors (id, name, display_name)
),
channel:publishing_channels (id, name, network_type, post_text_prompt, back_cover_video_url)
```

#### 2. Обновить интерфейс `Publication` в `usePublications.ts`

Добавить `hook`, `advisor_answer`, `voiceover_url` в тип `video`, и `post_text_prompt`, `back_cover_video_url` в тип `channel`.

#### 3. Убрать `as any` кастинг в `PublicationEditDialog.tsx`

Заменить `(pub.video as any)?.hook` и аналогичные на прямое обращение к полям, теперь что они есть в типе.

#### 4. Исправить `requiresConcat` в `PublicationsTable.tsx`

Сейчас `channelsById` строится из `usePublishingChannels`, но `requiresConcat` проверяет `channel.back_cover_video_url` на объекте из этого Map. Нужно убедиться что данные канала в publications тоже содержат `back_cover_video_url` — после п.1 это будет доступно через `pub.channel?.back_cover_video_url`.

#### 5. Проксировать загрузку видео для склейки

`fetchFile()` из ffmpeg.wasm не может загрузить видео с внешних доменов (HeyGen, storage) из-за CORS. Решение: загружать видео через `supabase.storage` (если файл в storage) или через fetch с blob, обходя CORS через edge function-прокси. Более простой вариант — скачивать файл через `fetch` с серверной стороны, создав небольшой edge function `proxy-video`.

Альтернатива (проще): если видео хранятся в storage bucket `media-files` (public), то URL вида `supabase.storage.from('media-files').getPublicUrl(...)` доступен без CORS проблем. Проверить откуда берутся URL.

