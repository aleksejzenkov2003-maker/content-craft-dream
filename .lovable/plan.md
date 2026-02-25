

## Diagnosis

I thoroughly analyzed the entire CSV import pipeline and identified **multiple critical bugs** that collectively cause all imports to fail. Here's the complete root cause analysis:

### Bug 1: `handleApplyMapping` in CsvImporter.tsx breaks multiline CSV data (Line 188)

When the user clicks "Пересчитать" (which happens automatically or manually), the `handleApplyMapping` function re-parses the raw file content using a naive `split('\n')` instead of the proper `splitCSVIntoRows()` function. This breaks any CSV with multiline quoted values (common in Excel exports), and **also breaks Excel files** because `XLSX.utils.sheet_to_csv()` output may contain multiline cells.

**Critical**: Even without multiline issues, this function builds a completely new set of rows using raw line splitting but then **overwrites** the properly parsed `resolvedRows`. This means the preview data gets corrupted every time mapping is recalculated.

### Bug 2: AdvisorsGrid and PlaylistsGrid don't receive `onBulkImport` prop from Index.tsx

Looking at `Index.tsx` lines 237-249 (AdvisorsGrid) and 324-335 (PlaylistsGrid), **neither component receives an `onBulkImport` prop**. This means:
- AdvisorsGrid: `onBulkImport` is `undefined`, so `handleImport` calls `onBulkImport(data)` which does nothing (no-op)
- PlaylistsGrid: Same problem — `onBulkImport` is `undefined`

The import dialog opens, shows the preview, user clicks "Import", and... nothing happens because the callback is undefined.

### Bug 3: ScenesMatrix import passes `advisor_name` and `playlist_name` virtual fields to database

In `ScenesMatrix.tsx`, the `resolveRow` returns data with both `advisor_name`, `playlist_name` AND the resolved `advisor_id`, `playlist_id`. But these virtual fields (`advisor_name`, `playlist_name`) are **never deleted** from the data before insertion. The `playlist_scenes` table doesn't have columns `advisor_name` or `playlist_name`, which causes a silent database error.

### Bug 4: QuestionsTable import requires `question_id` but the error handling flow blocks all rows

From the screenshot (image-60.png), all 11 rows show "Плейлист не найден" errors. The `resolveRow` marks rows as invalid, and then `handleImport` in CsvImporter only imports `validRows`. With all rows marked invalid due to missing playlists, **0 rows get imported**.

The auto-create playlists logic was added in `onImport`, but the `resolveRow` still marks rows as errors in the preview phase, so the user sees "Импортировать 0 записей".

### Bug 5: Videos (Ролики) import from Index.tsx uses old VideoImportDialog, not CsvImporter

Looking at `Index.tsx` line 292-298, the Videos tab uses `VideoImportDialog` (the old XLSX-only importer), not the universal `CsvImporter`. This means the improved column mapping, field definitions, and normalization logic don't apply to video imports at all.

### Bug 6: Missing `Плейлист_рус` / `Вопрос_рус` / etc. column mappings for underscore variants

The Excel file "Вопросы_2.xlsx" has headers like `Плейлист_рус`, `Плейлист_eng`, `Вопрос_eng`, `Вопрос_рус`. While `normalizeHeader` replaces underscores with spaces, the column mapping keys like `'плейлист рус'` DO exist. However, `Плейлист_eng` normalizes to `плейлист eng` which maps to `playlist_name`, and `Плейлист_рус` also normalizes to `плейлист рус` which ALSO maps to `playlist_name`. This means two columns both map to the same field, and the second one overwrites the first — losing data.

---

## Fix Plan

### 1. Fix `handleApplyMapping` in CsvImporter.tsx
- Replace the naive `split('\n')` re-parsing with a call to `parseCSV()` using the custom mapping
- Use proper `splitCSVIntoRows()` for multiline handling
- The key fix: build the new mapping from `customMapping`, call `parseCSV(rawFileContent, newMapping, requiredFields)`, and use its rows directly

### 2. Wire `onBulkImport` for AdvisorsGrid and PlaylistsGrid in Index.tsx
- Pass `onBulkImport` to `AdvisorsGrid` using `useAdvisors().bulkImport`
- Pass `onBulkImport` to `PlaylistsGrid` using `usePlaylists().bulkImport`

### 3. Fix ScenesMatrix to strip virtual fields before import
- In `handleImport`, strip `advisor_name`, `playlist_name`, `scene_name` from each row before passing to `bulkImport`
- Add auto-create logic for advisors and playlists referenced in scenes

### 4. Fix QuestionsTable resolveRow to NOT mark missing playlists as errors
- Remove the error for missing playlists/advisors in `resolveRow` — instead, keep the name as a virtual field
- The `onImport` handler already has auto-create logic, so rows should be valid in preview
- Add auto-create logic for advisors too (not just playlists)

### 5. Add `playlist_rus` as a separate mapped field
- Add `'плейлист рус': 'playlist_rus'` to QUESTION_COLUMN_MAPPING (a virtual field that gets merged into `playlist_name` during import)
- Or better: map both `Плейлист_eng` and `Плейлист_рус` to `playlist_name`, but pick the English one preferentially

### 6. Add proper error handling and toast messages
- Wrap all `onImport` handlers in try/catch with explicit error toasts
- Show the actual Supabase error message when import fails
- Add console.error logging for debugging

### 7. Clean up virtual fields in ALL importers
- Every importer that uses `resolveRow` should strip virtual fields (`advisor_name`, `playlist_name`, `channel_name`, `_ignore`, etc.) from the data before database insertion

### Technical Details

**Files to modify:**

1. **`src/components/import/CsvImporter.tsx`** (lines 171-223)
   - Fix `handleApplyMapping` to use proper CSV parsing instead of naive line splitting

2. **`src/pages/Index.tsx`** (lines 237-249, 324-336)  
   - Add `onBulkImport` prop to `AdvisorsGrid` and `PlaylistsGrid`

3. **`src/components/scenes/ScenesMatrix.tsx`** (lines 149-191)
   - Strip virtual fields before `bulkImport`
   - Add auto-create for missing advisors/playlists

4. **`src/components/questions/QuestionsTable.tsx`** (lines 584-716)
   - Fix `resolveRow` to not error on missing playlists/advisors
   - Add auto-create advisors (not just playlists)
   - Strip ALL virtual fields before DB insert

5. **`src/components/import/importConfigs.ts`** (lines 62-66)
   - Map `'плейлист рус'` to a separate virtual field `playlist_name_rus` instead of `playlist_name`, to avoid overwriting the English name

6. **`src/components/advisors/AdvisorsGrid.tsx`** (line 136-140)
   - Add error toast on import failure

7. **`src/components/playlists/PlaylistsGrid.tsx`** (line 69-73)
   - Add error toast on import failure

