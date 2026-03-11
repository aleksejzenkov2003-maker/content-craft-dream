

## Проблема склейки с новыми роликами HeyGen

### Диагноз

Текущий код в `src/lib/videoConcat.ts` использует **concat filter с перекодированием** (`-c:v libx264`). Это означает, что ffmpeg.wasm в браузере полностью декодирует оба видео и кодирует заново — крайне медленная операция в WebAssembly.

Новые ролики из HeyGen Avatar III (v2 API) могут иметь другие параметры кодирования (другой профиль H.264, другой timescale, другое разрешение), из-за чего concat filter работает ещё медленнее или зависает.

### Решение

Заменить concat filter на **concat demuxer** с `-c copy` (побитовое копирование без перекодирования). Если потоки совместимы — склейка занимает 1-3 секунды. Если `-c copy` не удался — fallback на `-c:v libx264 -preset ultrafast` (быстрее текущего `fast`).

### Изменения

**`src/lib/videoConcat.ts`** — переписать метод склейки:

```text
Было:
  ffmpeg -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1" -c:v libx264 -preset fast

Станет (приоритет):
  1. ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4        ← мгновенно
  2. Fallback: ffmpeg -i a -i b -filter_complex concat -c:v libx264 -preset ultrafast  ← если -c copy не сработал
```

Конкретные шаги:
1. Записать файл-список `list.txt` с путями к двум видео в виртуальной FS
2. Выполнить `ffmpeg -f concat -safe 0 -i list.txt -c copy -y output.mp4`
3. Проверить размер результата (>10KB)
4. Если пустой — fallback с `-preset ultrafast` вместо `fast`
5. Убрать промежуточный retry с video-only (упростить логику)

Ожидаемый результат: склейка за секунды вместо минут.

