

# Починить субтитры: DataCloneError при повторном использовании шрифта

## Корневая причина

В `src/lib/videoSubtitles.ts` строка 51:
```js
await ff.writeFile(FONT_PATH, fontData);
```

`fontData` — кешированный `Uint8Array`. При первом вызове FFmpeg **transferit** его `ArrayBuffer` в Worker (zero-copy). После этого буфер **detached** — он пуст. При втором вызове `fontData !== null` (проверка пройдена), но буфер уже мёртв → `DataCloneError`.

Это значит: первая вшивка субтитров после загрузки страницы работает, а все последующие — падают.

## Исправление

**Файл**: `src/lib/videoSubtitles.ts`

В `ensureFont()` — передавать **копию** буфера вместо оригинала:

```typescript
// Было:
await ff.writeFile(FONT_PATH, fontData);

// Стало:
await ff.writeFile(FONT_PATH, new Uint8Array(fontData));
```

`new Uint8Array(fontData)` создаёт копию с новым `ArrayBuffer`. Оригинал остаётся целым для следующих вызовов.

Одна строка, одно исправление. Всё остальное в pipeline субтитров работает корректно.

