

## Решение: бинарная MP4-конкатенация + нормализация аудио через ffmpeg.wasm

### Что сделано

1. **`supabase/functions/concat-video/index.ts`** — полная перезапись:
   - Бинарный MP4-парсер: разбор боксов (moov/trak/stbl/stsz/stco/stsc/stts/stss/ctts)
   - Извлечение сэмплов из обоих файлов, сборка нового mdat
   - Объединение sample tables, пересчёт оффсетов, обновление duration
   - Сохранение логики получения свежих HeyGen URL
   - Загрузка результата в Storage

2. **`src/lib/videoNormalizer.ts`** — утилита нормализации аудио через ffmpeg.wasm:
   - Загружает ffmpeg WASM при первом использовании
   - Перекодирует аудио в AAC-LC 48kHz mono 128kbps: `-c:v copy -c:a aac -ar 48000 -ac 1 -b:a 128k`
   - Видео-поток копируется без потерь

3. **`src/components/covers/BackCoversGrid.tsx`** — интеграция нормализации:
   - При загрузке видео-обложки автоматически нормализует аудио через ffmpeg.wasm
   - Показывает прогресс нормализации
   - Загружает нормализованный файл в Storage
   - Fallback на оригинал при ошибке

### Зависимости
- `@ffmpeg/ffmpeg@0.12.10`
- `@ffmpeg/util@0.12.1`

---

## Субтитры: ElevenLabs timestamps → SRT → FFmpeg

### Что сделано

1. **БД миграция** — добавлено поле `word_timestamps jsonb` в таблицу `videos`

2. **Edge Functions** — обновлены оба voiceover-генератора:
   - `supabase/functions/generate-voiceover-for-video/index.ts` → endpoint `/with-timestamps`
   - `supabase/functions/generate-voiceover/index.ts` → endpoint `/with-timestamps`
   - Ответ содержит `audio_base64` + `alignment` (character-level timestamps)
   - Функция `buildWordTimestamps()` собирает word-level timestamps из character-level
   - Timestamps сохраняются в `videos.word_timestamps`

3. **`src/lib/srtGenerator.ts`** — генерация субтитров:
   - `generateSrt()` — SRT формат (группировка по N слов)
   - `generateAss()` — ASS формат (со стилями: шрифт, размер, цвет, обводка)
   - `generateSrtBlocks()` — промежуточная структура

4. **`src/lib/videoSubtitles.ts`** — вшивание субтитров через ffmpeg.wasm:
   - `burnSubtitles(videoUrl, timestamps, options, onProgress)` → File
   - Использует ASS-фильтр для стилизованных субтитров
   - Видео перекодируется libx264 (preset fast, crf 23), аудио копируется

5. **UI** — кнопка «Добавить субтитры» в `VideoSidePanel`:
   - Появляется когда есть `heygen_video_url` и `word_timestamps`
   - Показывает прогресс через Progress bar
   - Результат загружается в Storage и сохраняется в `video_path`
