

## Изменение текста на обложке: английский вопрос вместо русского хука

### Проблема
Сейчас на обложку накладывается русский текст — строка 454:
```typescript
const hookText = video.hook_rus || video.hook || video.question || '';
```

### Решение
Заменить приоритет на английский вопрос:
```typescript
const hookText = video.question_eng || video.hook || video.question || '';
```

### Файл
**`supabase/functions/generate-cover/index.ts`** — одна строка (454).

