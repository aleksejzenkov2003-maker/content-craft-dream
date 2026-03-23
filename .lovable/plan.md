

## Проблема

При склейке видео (main + back cover) без интро используется **stream copy** (`-c copy`), который просто копирует потоки без перекодирования. Если основное видео и задняя обложка имеют разные параметры (FPS, timebase, аудио sample rate), результат получается с ускорением и рассинхроном аудио.

Проверка на ошибку (`outputData.length < 10000`) ловит только пустые файлы, но не «валидные файлы с битыми таймстампами» — поэтому fallback на re-encode не срабатывает.

## Исправление

**Файл: `src/lib/videoConcat.ts`**

Убрать ветку stream copy и **всегда** использовать re-encode через `filter_complex concat`:

```text
Было:
  if (hasIntro) → re-encode
  else → stream copy (-c copy) → fallback re-encode если файл пустой

Станет:
  Всегда → filter_complex concat с re-encode
  (нормализация FPS, audio sample rate, разрешения)
```

Конкретные изменения:
1. Удалить ветку `if (hasIntro) / else` со stream copy
2. Сразу строить `filter_complex` с перечислением всех входных файлов (intro если есть + main + back)
3. Добавить `-r 30` и `-video_size 1080x1920` для нормализации выходного формата
4. Оставить fallback через concat demuxer + re-encode как запасной вариант (вместо текущего stream copy → filter_complex)

Это чуть медленнее stream copy, но гарантирует корректные таймстампы и синхронизацию аудио.

