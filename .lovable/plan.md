

## Диагноз

Проблема не в коде маппинга stsd/stsc/stco — она в **самом подходе бинарной MP4-конкатенации**. Логи подтверждают: аудио-stsd обоих файлов — mp4a, одинакового размера (107 байт), одинакового timescale (48000), но с различающимися байтами конфигурации (AudioSpecificConfig в esds box).

Были попробованы оба варианта:
1. **Dedup stsd** (сохранить только конфиг файла 1) → декодер использует неправильные параметры для AAC-фреймов задней обложки → тишина
2. **Keep both stsd entries** (сохранить оба) → большинство плееров не поддерживают переключение sample description mid-stream → игнорируют второй entry → тишина

**Вывод:** бинарная конкатенация MP4 с разными AAC-конфигурациями невозможна без транскодинга аудио. Edge Functions не могут запустить FFmpeg.

## Решение

Заменить бинарную MP4-конкатенацию на вызов **n8n webhook** (уже настроен: `N8N_WEBHOOK_URL`), который склеит видео через FFmpeg с пере-кодированием только аудио:

```
ffmpeg -i main.mp4 -i backcover.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v copy -c:a aac -b:a 128k output.mp4
```

Это копирует видео-поток без потерь (`-c:v copy`), но пере-кодирует аудио в единый AAC-формат (`-c:a aac`), гарантируя совместимость.

## Файлы для изменения

### `supabase/functions/concat-video/index.ts` — полная замена логики

Вместо ~700 строк MP4-парсера:

1. Скачать main video URL (через HeyGen API — эта часть остаётся)
2. Отправить POST на `N8N_WEBHOOK_URL` с телом:
   ```json
   {
     "publication_id": "...",
     "main_video_url": "resolved_fresh_url",
     "back_cover_video_url": "...",
     "callback_url": "supabase_storage_upload_path"
   }
   ```
3. n8n workflow: скачивает оба файла → FFmpeg concat → загружает результат в Supabase Storage → возвращает URL
4. Edge Function получает URL, обновляет `publications.final_video_url` и статус

Fallback: если n8n недоступен, сохранить текущую бинарную конкатенацию как запасной вариант.

### На стороне n8n (пользователь настраивает сам)

Webhook → Download File (main) → Download File (back cover) → FFmpeg node → Upload to Supabase Storage → Respond to Webhook

## Альтернатива без n8n

Если n8n-подход не подходит, второй вариант: при **загрузке задней обложки** (в `BackCoversGrid`) пере-кодировать аудио через отдельную Edge Function, которая вызывает ElevenLabs или другой API для генерации совместимого аудио-трека, а потом перепаковывает MP4.

