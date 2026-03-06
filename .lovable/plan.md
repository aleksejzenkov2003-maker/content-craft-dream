

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
