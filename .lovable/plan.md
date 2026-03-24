

## Применение ручных исправлений FFmpeg-пайплайна

Пользователь предоставил исправленные версии 5 файлов. Ниже — конкретные изменения, которые нужно внести.

### 1. `src/lib/videoConcat.ts` — try/catch для normalizeSegment

Обернуть первый `ff.exec` в `try/catch` и добавить флаг `primarySucceeded`. Условие fallback: `if (!primarySucceeded || !ok)` вместо текущего `if (!ok)`.

**Строки ~66-96**: добавить `let primarySucceeded = false`, обернуть exec в try/catch, изменить условие.

### 2. `src/lib/videoOverlay.ts` — улучшение хромакея и масштабирования

Три изменения в блоке filter_complex (~строка 72-79):

- **Фон**: `force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1` вместо `decrease,pad`
- **Хромакей**: `chromakey=0x00B140:0.30:0.08` вместо текущих параметров
- **Аудио**: `-map 1:a?` вместо `-map 1:a` (не падает без аудио)

### 3. `src/lib/videoSubtitles.ts` — реальный highlight (karaoke) режим

Переписать функцию `buildHighlightDrawtextFilter` (~строки 116-154):

- Добавить базовую белую строку для всего блока
- Добавить пословные интервалы с жёлтой подсветкой (`fontcolor=yellow`) по таймкодам `word.start` → `word.end`
- Текущий слово — `toUpperCase()`

### 4. `src/pages/Index.tsx` — фикс пайплайна после overlay

**Строка 294**: заменить `sourceUrl` на `finalUrl` в вызове `reduceVideoBitrate`. Без этого overlay терялся на шаге сжатия.

### 5. `src/lib/videoNormalizer.ts` — корректный resize без искажений

**Строки ~146-153**: заменить `-vf`, `scale=${p.width}:${p.height}` на цепочку:
```
scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease,
pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2,
setsar=1
```

### Файлы

| Файл | Суть изменения |
|---|---|
| `src/lib/videoConcat.ts` | try/catch + primarySucceeded в normalizeSegment |
| `src/lib/videoOverlay.ts` | increase+crop для фона, мягкий хромакей, `-map 1:a?` |
| `src/lib/videoSubtitles.ts` | Реальный karaoke-highlight с пословной подсветкой |
| `src/pages/Index.tsx` | `finalUrl` вместо `sourceUrl` в reduceVideoBitrate |
| `src/lib/videoNormalizer.ts` | Корректный resize с сохранением пропорций |

