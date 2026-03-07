

## Анализ вариантов субтитров

### Вариант 1: ElevenLabs timestamps → SRT → FFmpeg
**Лучший вариант.**
- Текст уже есть (advisor_answer), ошибок распознавания нет
- ElevenLabs API возвращает `alignment` с word-level timestamps при генерации речи — это бесплатно, в том же запросе
- Нужен только FFmpeg для вшивания SRT в видео

**Проблема**: FFmpeg нельзя запустить в Edge Function. Нужен внешний сервис (n8n) или клиентский ffmpeg.wasm.

### Вариант 2: Whisper
- Требует отдельный API (OpenAI Whisper или аналог)
- Ошибки распознавания на русском языке
- Лишний шаг — текст уже известен

### Вариант 3: WhisperX + forced alignment
- Точнее Whisper, но сложнее в настройке
- Всё равно требует отдельный сервис
- Избыточно, если ElevenLabs уже даёт timestamps

---

### Рекомендация: Вариант 1

### Реализация

#### 1. Изменить `generate-voiceover` Edge Function
- Добавить параметр `with_timestamps: true` в запрос к ElevenLabs API
- Endpoint: `/v1/text-to-speech/{voice_id}/with-timestamps`
- Сохранять полученные word timestamps в БД (новое поле `word_timestamps` в таблице `voiceovers` или `videos`)

#### 2. Генерация SRT на клиенте
- Утилита `generateSRT(timestamps)` — группирует слова по 5-7 в строку, формирует SRT-файл
- Это чистый текстовый формат, никаких зависимостей не нужно

#### 3. Вшивание субтитров через FFmpeg
Два варианта:
- **ffmpeg.wasm** (уже установлен в проекте) — вшивает SRT в видео прямо в браузере
- **n8n webhook** — отправляет видео + SRT на сервер с FFmpeg

Учитывая что ffmpeg.wasm уже в зависимостях и n8n отвергнут — используем ffmpeg.wasm в браузере.

### Файлы для изменения

| Файл | Что делаем |
|---|---|
| `supabase/functions/generate-voiceover/index.ts` | Переключить на endpoint `with-timestamps`, сохранять timestamps |
| `supabase/functions/generate-voiceover-for-video/index.ts` | Аналогично — timestamps |
| БД миграция | Добавить `word_timestamps jsonb` в таблицу `videos` или `voiceovers` |
| `src/lib/srtGenerator.ts` | Новый файл — генерация SRT из word timestamps |
| `src/lib/videoSubtitles.ts` | Новый файл — вшивание SRT в видео через ffmpeg.wasm |
| UI компонент | Кнопка "Добавить субтитры" в панели видео |

### Формат timestamps от ElevenLabs

```json
{
  "alignment": {
    "characters": ["H","e","l","l","o"],
    "character_start_times_seconds": [0.0, 0.05, ...],
    "character_end_times_seconds": [0.05, 0.1, ...]
  }
}
```

Из character-level timestamps собираем word-level, затем группируем в SRT-блоки.

