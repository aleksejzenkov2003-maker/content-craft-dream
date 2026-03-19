

## Добавить пресеты сжатия видео в настройки

### Что нужно сделать

Добавить в раздел «Настройки видеоформата» блок с 5 пресетами сжатия. Выбранный пресет сохраняется в `app_settings` и используется при уменьшении битрейта в `reduceVideoBitrate`.

### Пресеты (из ТЗ)

| # | Название | Размер | CRF | Preset | FPS | Audio | Faststart |
|---|----------|--------|-----|--------|-----|-------|-----------|
| 1 | Light Compress (~2x) | 1080×1920 | 24 | slow | 30 | aac 128k | on |
| 2 | Balanced Social (~3x) ✓ | 900×1600 | 26 | medium | 24 | aac 96k | on |
| 3 | Compact Social (~4x) | 720×1280 | 28 | medium | 24 | aac 96k | on |
| 4 | Very Compact (~5x) | 720×1280 | 30 | medium | 20 | aac 64k | on |
| 5 | Max Social (~6x) | 540×960 | 31 | slow | 20 | aac 64k | on |

По умолчанию — **Balanced Social** (пресет #2).

### Изменения

#### 1. `src/lib/videoNormalizer.ts`
- Экспортировать интерфейс `CompressionPreset` и массив `COMPRESSION_PRESETS`
- Добавить в `reduceVideoBitrate` опциональный параметр `preset?: CompressionPreset`
- Использовать параметры пресета вместо хардкода (`-crf`, `-preset`, `-r`, `-b:a`, `-vf scale`, `-movflags +faststart`)

#### 2. `src/components/settings/VideoFormatSettings.tsx`
- Добавить секцию «Настройки сжатия» с RadioGroup из 5 пресетов
- Загружать/сохранять выбранный пресет в `app_settings` (ключ `compression_preset`)
- Показывать FFmpeg-параметры мелким текстом под каждым пресетом

#### 3. `src/pages/Index.tsx`
- Перед вызовом `reduceVideoBitrate` загружать выбранный пресет из `app_settings`
- Передавать его в функцию `reduceVideoBitrate`

