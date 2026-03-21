

# Исправление панели активных процессов + видимость FFmpeg шагов

## Проблемы

### 1. Не листается список
`ScrollArea` с `max-h-[500px]` не работает, потому что у `ScrollArea` нет фиксированной высоты — `max-h` на Root не создаёт ограничение для Viewport. Нужно поставить `h-[500px]` или использовать `className` с `overflow-auto` напрямую.

### 2. Шаги битрейта/субтитров не видны в панели
Постобработка (FFmpeg bitrate + subtitles) **не пишет ничего в `activity_log`** — она только показывает toasts и обновляет `autoSubtitleProgress` state. Панель `ActiveProcesses` читает только из `activity_log`, поэтому эти шаги невидимы. Нужно:
- Логировать шаги постобработки в `activity_log` (начало, завершение, ошибки)
- Показывать текущий прогресс FFmpeg в панели (из `autoSubtitleProgress` state)

### 3. FFmpeg-процессы не отображаются как активные
`useActiveProcesses` фильтрует по `reel_status = 'generating'`, но FFmpeg-процесс идёт в браузере и `reel_status` обновляется. Проблема в том что панель не отображает прогресс FFmpeg в реальном времени. Нужно передавать `autoSubtitleProgress` в `ActiveProcesses` и показывать progress bar для видео с активным FFmpeg.

### 4. "С субтитрами" без субтитров
Лейбл "С субтитрами" ставится всегда когда `video_path !== heygen_video_url`. Но если субтитры не вшились (ошибка или disabled), `video_path` всё равно заполняется reduced-видео. Нужно проверять наличие `word_timestamps` и `reel_status` для правильного лейбла.

## Что делаем

### 1. Починить скролл ActiveProcesses
Заменить `<ScrollArea className="max-h-[500px]">` на `<div className="max-h-[500px] overflow-y-auto">` — простое решение без проблем Radix.

### 2. Логировать FFmpeg шаги в activity_log
В `postProcessVideo` добавить записи:
- `bitrate_reduction_started` — начало сжатия
- `bitrate_reduction_complete` — завершение (с duration)
- `subtitle_burn_started` — начало вшивки
- `subtitle_burn_complete` — завершение
- `subtitle_burn_failed` — ошибка
- `postprocessing_complete` — финал

### 3. Передать FFmpeg-прогресс в ActiveProcesses
Передать `autoSubtitleProgress` как prop в `ActiveProcesses`. Если для видео есть активный FFmpeg-процесс — показывать progress bar с фазой (reducing_bitrate / burning_subtitles / uploading).

### 4. Исправить лейбл "С субтитрами"
В `VideoSidePanel` проверять: если `video_path` есть и `reduced_video_url` тоже и они совпадают — значит субтитры не вшились → лейбл "Сжатое видео". Если `video_path !== reduced_video_url` и `word_timestamps` есть → "С субтитрами".

## Файлы

- `src/components/dashboard/ActiveProcesses.tsx` — скролл + progress bar + FFmpeg-фаза
- `src/hooks/useActiveProcesses.ts` — без изменений
- `src/pages/Index.tsx` — логирование шагов в activity_log + передача autoSubtitleProgress
- `src/components/videos/VideoSidePanel.tsx` — правильный лейбл видео-варианта

