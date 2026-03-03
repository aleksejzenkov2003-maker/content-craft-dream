

## Issues Found

### 1. "Ожидаемые поля" shows only 3 fields (no scroll)
The `FieldStructureInfo` component renders inside the import dialog's `<div className="flex-1 overflow-hidden">` container (line 258, CsvImporter.tsx). The `overflow-hidden` cuts off the field list. The parent `<div>` wrapping the drop zone and FieldStructureInfo (lines 290-312) has no scroll capability.

**Fix**: Wrap the drop zone + FieldStructureInfo block in a `ScrollArea` or add `overflow-auto` so all 15 field definitions are visible.

### 2. Toast says "роликов" instead of "вопросов"
In `QuestionsTable.tsx` line 810:
```
toast.info(`Создание ${expanded.length} роликов (${transformed.length} вопросов × ${activeAdvisorIds.length} духовников)`);
```
The message is technically correct (it creates video records), but confusing in the Questions import context. Should say "Импортировано X вопросов" after success, not announce internal video creation.

**Fix**: Change the toast message on line 810 to say "вопросов" and also check the `onBulkImport` callback in Index.tsx (line 839-842) — it calls `bulkImport` silently but doesn't show a success toast. Add a proper success toast saying "Импортировано N вопросов".

### 3. Page doesn't scroll
The `CsvImporter` dialog content has `className="max-w-4xl max-h-[90vh] flex flex-col"` and the inner content area has `className="flex-1 overflow-hidden"` (line 258). Before a file is loaded, the content (drop zone + FieldStructureInfo) exceeds the dialog height but `overflow-hidden` prevents scrolling.

**Fix**: Change `overflow-hidden` to `overflow-auto` on line 258 of CsvImporter.tsx.

---

## Files to Change

### `src/components/import/CsvImporter.tsx`
- Line 258: Change `overflow-hidden` → `overflow-auto` to allow scrolling of the dialog content (fixes issues 1 and 3)

### `src/components/questions/QuestionsTable.tsx`
- Line 810: Change toast message from "Создание N роликов..." to "Импортировано N вопросов"

