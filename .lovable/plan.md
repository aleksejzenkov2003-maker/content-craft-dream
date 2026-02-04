
# План: Добавление колонки текста публикации и автогенерация

## Задача

1. **Добавить колонку "Текст"** в таблицу публикаций между "Статус" и "Просмотры"
2. **Показывать превью текста** или кнопку "Генерировать" если текста нет
3. **Автогенерация** при создании публикации (когда ролик отправляется на канал)

## Изменения

### 1. PublicationsTable.tsx - новая колонка

Добавить колонку "Текст" в шапку таблицы (после "Статус"):

```typescript
<TableHead className="w-[200px]">Текст</TableHead>
```

Добавить ячейку с превью текста или кнопкой генерации:

```typescript
<TableCell onClick={(e) => e.stopPropagation()}>
  {pub.generated_text ? (
    <p className="text-xs text-muted-foreground line-clamp-2 max-w-[180px]">
      {pub.generated_text}
    </p>
  ) : (
    <Button
      size="xs"
      variant="outline"
      disabled={generatingIds.has(pub.id)}
      onClick={() => handleGenerateText(pub)}
    >
      {generatingIds.has(pub.id) ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          <Sparkles className="w-3 h-3 mr-1" />
          Генерировать
        </>
      )}
    </Button>
  )}
</TableCell>
```

### 2. usePublications.ts - автогенерация при создании

Обновить функцию `addPublication` для автоматического запуска генерации текста:

```typescript
const addPublication = async (data: Partial<Publication>, autoGenerateText = true) => {
  // ... существующий код создания ...
  
  if (autoGenerateText && inserted?.id) {
    // Запускаем генерацию текста в фоне
    try {
      await supabase.functions.invoke('generate-post-text', {
        body: { publicationId: inserted.id },
      });
    } catch (e) {
      console.error('Auto-generate text failed:', e);
      // Не блокируем создание публикации при ошибке генерации
    }
  }
  
  await fetchPublications();
  return inserted?.id;
};
```

### 3. VideoSidePanel.tsx - передача флага автогенерации

Обновить `onPublish` для передачи флага автогенерации (уже работает через addPublication).

## Технические детали

| Файл | Изменение |
|------|-----------|
| `src/components/publishing/PublicationsTable.tsx` | Добавить колонку "Текст" с превью или кнопкой генерации |
| `src/hooks/usePublications.ts` | Автогенерация текста при создании публикации |

## Визуальный результат

Таблица будет выглядеть так:

```
| ✓ | Заголовок | ID | Дата | Длина | Статус | Текст | Просмотры | Лайки | Действия |
|---|-----------|----|----- |-------|--------|-------|-----------|-------|----------|
|   | Вопрос... | 2  | ...  | —     | Ожид.  | 🙏 ... | —         | —     | ✨ 📤 ⋮  |
|   | Вопрос... | 18 | —    | —     | Ожид.  | [Генер]| —         | —     | ✨ 📤 ⋮  |
```

- Если текст есть - показывается превью (2 строки)
- Если текста нет - кнопка "Генерировать"
- Кнопка ✨ в колонке "Действия" остаётся для повторной генерации
