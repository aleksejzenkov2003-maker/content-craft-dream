
# План исправления: Смена статуса и круглые чекбоксы

## Анализ проблемы

### Проблема 1: Бесконечный цикл уведомлений при смене статуса
**Причина:** В `Index.tsx` используются два разных экземпляра `useVideos`:
- `allVideos` - для таблицы Вопросов
- `videos` - для таблицы Роликов

При вызове `onUpdateQuestion` происходит:
1. Обновление видео через `updateVideo` (из второго хука)
2. `fetchVideos()` вызывается для каждого обновлённого видео
3. Каждый `fetchVideos()` перезагружает все данные
4. React Query не используется — нет инвалидации, каждый хук делает свои запросы

**Решение:**
- Оптимизировать обновление: сделать один bulk update вместо цикла
- Убрать лишние `fetchVideos()` вызовы
- Добавить дебаунсинг или batch update

### Проблема 2: Кружки вместо квадратных чекбоксов
**Причина:** Код в `QuestionsTable.tsx` показывает что `Checkbox` компонент уже используется (строки 553-556, 596-599, 650-654), но на скриншоте видны кружки.

Возможные причины:
1. Файл не был сохранён/применён
2. Браузер закешировал старую версию
3. Есть конфликт в git

**Проверка:** Компонент `src/components/ui/checkbox.tsx` имеет `rounded-sm` — это правильно, должны быть квадраты.

---

## План исправления

### Шаг 1: Исправить цикл обновлений

**Файл:** `src/hooks/useVideos.ts`

Добавить метод `bulkUpdate` для массового обновления без множественных refetch:

```typescript
const bulkUpdate = async (updates: { id: string; data: Partial<Video> }[], options?: { silent?: boolean }) => {
  try {
    // Последовательно обновляем все записи без refetch
    for (const { id, data } of updates) {
      const { error } = await supabase
        .from('videos')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    }
    // Один refetch в конце
    await fetchVideos();
    if (!options?.silent) {
      toast.success(`Обновлено ${updates.length} записей`);
    }
  } catch (error) {
    console.error('Error bulk updating videos:', error);
    toast.error('Ошибка обновления');
    throw error;
  }
};
```

**Файл:** `src/pages/Index.tsx`

Изменить `onUpdateQuestion` чтобы использовать bulk update:

```typescript
onUpdateQuestion={async (questionId, updates) => {
  const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
  // Один bulk update вместо цикла
  await bulkUpdateVideos(
    videosToUpdate.map(v => ({ id: v.id, data: updates })),
    { silent: true }
  );
  toast.success('Вопрос обновлён');
}}
```

### Шаг 2: Удалить refetch из каждого updateVideo при silent mode

**Файл:** `src/hooks/useVideos.ts`

```typescript
const updateVideo = async (id: string, updates: Partial<Video>, options?: { silent?: boolean; skipRefetch?: boolean }) => {
  try {
    const { error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // Не делаем refetch если указано skipRefetch
    if (!options?.skipRefetch) {
      await fetchVideos();
    }
    if (!options?.silent) {
      toast.success('Ролик обновлён');
    }
  } catch (error) {
    // ...
  }
};
```

### Шаг 3: Перезаписать QuestionsTable с чекбоксами

Проблема может быть в том, что файл не был правильно сохранён. Нужно убедиться что в колонке "Статус" (строки 637-655) используется `Checkbox`:

```tsx
{/* Column 7: Status - Inline Edit + Filter checkbox */}
<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
  <InlineEdit
    type="select"
    value={q.question_status}
    options={statusOptions}
    onSave={(value) => handleSaveQuestion(q.question_id, { question_status: value })}
    formatDisplay={(val) => {
      const opt = statusOptions.find(o => o.value === val);
      return opt?.label || 'Ожидает';
    }}
    displayClassName="text-xs"
  />
  <Checkbox
    checked={localSelectedIds.includes(q.question_id)}
    onCheckedChange={() => toggleFilterSelect(q.question_id)}
    className="border-primary data-[state=checked]:bg-primary"
  />
</div>
```

---

## Технические детали

### Изменяемые файлы
1. `src/hooks/useVideos.ts` - добавить `bulkUpdate`, опция `skipRefetch`
2. `src/pages/Index.tsx` - использовать bulk update
3. `src/components/questions/QuestionsTable.tsx` - подтвердить Checkbox компонент

### Порядок выполнения
1. Добавить `bulkUpdate` в хук
2. Обновить Index.tsx для использования bulk update
3. Принудительно перезаписать QuestionsTable чтобы гарантировать Checkbox

### Ожидаемый результат
- При смене статуса появляется одно уведомление "Вопрос обновлён"
- Нет бесконечного цикла обновлений
- Чекбоксы отображаются как квадраты (Checkbox компонент с `rounded-sm`)
