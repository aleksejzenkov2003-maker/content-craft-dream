
# Фаза 2: Экран «Вопросы» - План Реализации

## Обзор изменений

Фаза 2 включает 5 подзадач для улучшения экрана вопросов:
1. Расширенная форма добавления
2. Inline-редактирование в таблице
3. Фильтры и сортировка
4. Массовые действия
5. Разделение RU/EN полей

---

## 2.1 Расширенная форма добавления вопроса

### Текущее состояние
Сейчас форма содержит только 3 поля:
- ID вопроса
- Безопасность
- Текст вопроса

### Изменения
Расширить диалог добавления до полного набора полей:
- ID вопроса (автозаполнение)
- Вопрос RUS
- Вопрос ENG
- Хук RUS
- Хук ENG
- Безопасность (select)
- Плейлист (select)
- Дата публикации (DatePicker)

### Файлы
- `src/components/questions/QuestionsTable.tsx` - расширение диалога

---

## 2.2 Inline-редактирование в таблице

### Интеграция InlineEdit компонента
Заменить статичные ячейки на интерактивные:

| Колонка | Тип InlineEdit |
|---------|----------------|
| Безопасность | select |
| Дата публикации | datetime |
| Статус | select |

### Опции для select-полей
```text
Безопасность: safe, warning, danger, unchecked
Статус: pending, checked, approved, rejected
```

### Файлы
- `src/components/questions/QuestionsTable.tsx` - интеграция InlineEdit

---

## 2.3 Фильтры и сортировка

### Панель фильтров
Добавить Popover с фильтрами:
- Статус вопроса (multiselect)
- Безопасность (multiselect)
- Диапазон дат публикации (DateRange)
- Только с роликами / без роликов

### Сортировка
Клик на заголовок колонки для сортировки:
- ID (asc/desc)
- Актуальность (asc/desc)
- Дата публикации (asc/desc)

Визуальный индикатор направления сортировки.

### Файлы
- `src/components/questions/QuestionsTable.tsx` - добавление фильтров и сортировки

---

## 2.4 Массовые действия

### Использование BulkActionsBar
Заменить текущие кастомные панели на унифицированный компонент:

**Для выбора (circle checkbox):**
- Массовое удаление (уже есть)
- Массовая смена статуса
- Массовая смена безопасности
- Массовая генерация обложек

**Кнопки действий:**
- Удалить (destructive)
- Сменить статус (default)
- Генерация обложек (generate-cover)

### Props для Index.tsx
Добавить callbacks:
- `onBulkUpdateStatus`
- `onBulkUpdateSafety`
- `onBulkGenerateCovers`

### Файлы
- `src/components/questions/QuestionsTable.tsx` - интеграция BulkActionsBar
- `src/pages/Index.tsx` - добавить обработчики массовых действий

---

## 2.5 Разделение RU/EN полей

### Текущее состояние
Колонки уже разделены (Вопрос рус / Вопрос eng), но визуально не выделены.

### Улучшения
- Добавить визуальную маркировку языка (флаг или badge)
- Группировка колонок через разделитель

---

## Технические детали

### Новый интерфейс формы добавления
```typescript
interface NewQuestionForm {
  question_id: number;
  question_rus: string;
  question_eng: string;
  hook_rus: string;
  hook_eng: string;
  safety_score: string;
  playlist_id: string | null;
  publication_date: Date | null;
}
```

### Обновлённые Props QuestionsTable
```typescript
interface QuestionsTableProps {
  // ... существующие
  playlists: Playlist[];
  onBulkUpdateStatus?: (questionIds: number[], status: string) => Promise<void>;
  onBulkUpdateSafety?: (questionIds: number[], safety: string) => Promise<void>;
  onBulkGenerateCovers?: (questionIds: number[]) => Promise<void>;
}
```

### Состояние фильтров и сортировки
```typescript
interface FilterState {
  statusFilter: string[];
  safetyFilter: string[];
  dateRange: { from: Date | null; to: Date | null };
  hasVideos: boolean | null;
}

interface SortState {
  column: 'id' | 'relevance' | 'date' | null;
  direction: 'asc' | 'desc';
}
```

---

## Порядок реализации

1. **Расширенная форма** - обновить диалог добавления
2. **Inline-редактирование** - интегрировать InlineEdit в колонки
3. **Фильтры** - добавить Popover с опциями фильтрации
4. **Сортировка** - добавить клик на заголовки
5. **Массовые действия** - заменить панели на BulkActionsBar
6. **RU/EN маркировка** - добавить визуальное разделение
7. **Обновить Index.tsx** - добавить playlists prop и callbacks
8. **Обновить plan.md** - отметить завершение Фазы 2
