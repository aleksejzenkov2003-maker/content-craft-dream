

## План: Перенос FFmpeg с браузера на VPS

### Текущая проблема
Сейчас все тяжёлые видеооперации (склейка, overlay, сжатие, субтитры) выполняются в браузере через FFmpeg WASM. Это медленно (~0.1x speed), ненадёжно и ограничено памятью браузера.

### Архитектура решения

```text
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────→│  Edge Functions   │────→│  VPS (89.124.*)  │
│  (браузер)   │     │  (прокси/оркестр) │     │  FFmpeg native   │
│  без FFmpeg  │←────│                  │←────│  API сервер      │
└─────────────┘     └──────────────────┘     └──────────────────┘
```

### Что делаем

#### 1. Исправить текущую ошибку сборки
- **Файл**: `supabase/functions/generate-voiceover/index.ts` строка 48
- Добавить null-check: `if (video && (video.advisor as any)?.elevenlabs_voice_id)`

#### 2. Создать API-сервер для VPS
- Создаю готовый Node.js скрипт (`vps-ffmpeg-server.js`), который пользователь запустит на VPS
- Эндпоинты:
  - `POST /api/ffmpeg/concat` — склейка видео (main + back cover + optional intro)
  - `POST /api/ffmpeg/overlay` — наложение аватара на фон (chromakey)
  - `POST /api/ffmpeg/reduce` — сжатие битрейта
  - `POST /api/ffmpeg/subtitles` — вшивка субтитров
  - `POST /api/ffmpeg/normalize-audio` — нормализация аудио
- Каждый эндпоинт: скачивает видео по URL → обрабатывает нативным FFmpeg → загружает результат в Supabase Storage → возвращает public URL
- Скрипт будет положен в `/mnt/documents/` для скачивания

#### 3. Сохранить URL VPS как секрет
- Секрет `VPS_FFMPEG_URL` = `http://89.124.65.192:3100`
- Секрет `VPS_FFMPEG_SECRET` — токен для авторизации запросов

#### 4. Создать edge function `process-video-vps`
- Единая edge function, которая проксирует запросы к VPS
- Принимает: `{ operation, params }` 
- Передаёт на VPS, возвращает результат
- Обрабатывает ошибки и таймауты

#### 5. Модифицировать клиентский код
Заменить все вызовы browser FFmpeg на вызовы edge function:

| Файл | Что меняется |
|---|---|
| `src/lib/videoConcat.ts` | `concatVideosClient` → вызов edge function вместо локального FFmpeg |
| `src/lib/videoOverlay.ts` | `overlayAvatarOnBackground` → вызов edge function |
| `src/lib/videoNormalizer.ts` | `reduceVideoBitrate`, `normalizeVideoAudio` → вызов edge function |
| `src/lib/videoSubtitles.ts` | `burnSubtitlesBrowser` → вызов edge function |
| `src/hooks/useVideoConcat.ts` | Упростить (убрать abort/terminate FFmpeg) |
| `src/pages/Index.tsx` | Убрать preloadFFmpeg, упростить post-processing |
| `src/components/videos/VideoSidePanel.tsx` | Убрать preloadFFmpeg, упростить кнопки процессов |

#### 6. Удалить/деактивировать browser FFmpeg
- `src/lib/ffmpegLoader.ts` — оставить как fallback, но по умолчанию не использовать
- Убрать зависимости `@ffmpeg/ffmpeg` и `@ffmpeg/util` если полностью не нужны

### Что пользователь делает на VPS
После реализации я предоставлю:
1. Готовый файл `vps-ffmpeg-server.js` для скачивания
2. Инструкцию: `apt install ffmpeg nodejs npm && node vps-ffmpeg-server.js`
3. Systemd unit для автозапуска

### Результат
- Видео обрабатывается нативным FFmpeg на VPS (в 50-100x быстрее чем WASM)
- Браузер только отправляет запрос и показывает прогресс
- Нет проблем с таймаутами, памятью, скоростью
- Overlay минутного ролика: ~10 секунд вместо ~10 минут

