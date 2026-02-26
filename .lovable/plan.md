

## Plan: Auto-status on video import + Playlist column in Questions table

### Problem
1. When videos are imported with `question_id` values that match existing questions, those questions should automatically switch to "Взят в работу" (`in_progress`) status -- currently they stay in their old status.
2. The Questions table has no Playlist column -- users need to see and change playlists via a dropdown.

### Changes

#### 1. Auto-update question status after video import (`src/pages/Index.tsx`)

After the video `bulkImport()` call completes in the video import handler (~line 452), add logic to:
- Collect all unique `question_id` values from the imported videos
- Find all existing videos in the DB with those `question_id`s that have `question_status != 'in_progress'`
- Bulk update them to `question_status = 'in_progress'`
- Refetch both video lists

This ensures that when you import videos referencing question IDs, the corresponding questions in the Questions tab immediately show "Взят в работу".

#### 2. Add Playlist column to Questions table (`src/components/questions/QuestionsTable.tsx`)

**Data model changes:**
- Add `playlist_id` and `playlist_name` fields to the `QuestionData` interface
- In the `questions` useMemo aggregation, capture `playlist_id` from the first video of each question group

**UI changes:**
- Add a "Плейлист" column to the table grid (update grid template from 7 columns to 8)
- Render an `InlineEdit` dropdown (type `select`) populated with playlists from the `playlists` prop
- Wire the save handler to call `onUpdateQuestion` with `playlist_id`

**Update handler changes:**
- Extend `handleSaveQuestion` and `onUpdateQuestion` type signatures to accept `playlist_id`
- In `Index.tsx`, extend the `onUpdateQuestion` handler to pass `playlist_id` through to `bulkUpdateAll`

#### 3. Grid layout update

Current: `grid-cols-[40px_60px_120px_80px_1fr_130px_100px]` (7 cols)
New: `grid-cols-[40px_60px_120px_80px_1fr_140px_130px_100px]` (8 cols, playlist column ~140px before date)

### Files to modify
- `src/pages/Index.tsx` -- add post-import status sync + extend onUpdateQuestion for playlist_id
- `src/components/questions/QuestionsTable.tsx` -- add playlist_id to QuestionData, add playlist column with InlineEdit dropdown, update grid layout and types

