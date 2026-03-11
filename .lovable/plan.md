

## Plan: 6 Fixes for Prompt Editor (PromptsPage)

Based on the screenshot annotations:

### 1. Dialog should NOT close on save
**File:** `src/components/prompts/PromptsPage.tsx` line 153
- Remove `setIsDialogOpen(false)` from `handleSave`. Dialog stays open after saving.

### 2. Remove Max tokens field
**File:** `src/components/prompts/PromptsPage.tsx` lines 366-374
- Remove the max_tokens slider from the dialog form. Keep the value in state (default 4000) but don't show it.

### 3. Prompts don't pull into related entities
This is about verifying that prompts are correctly fetched and used in:
- **Publishing channels** — already works via `prompt_id` on `publishing_channels` table
- **Scenes (Сцены монологов)** — need to check `SceneSidePanel.tsx` restore logic
- **Atmosphere (Фон обложки)** — need to check atmosphere generation logic

These are existing features. The issue states prompts aren't being pulled — this likely means the `is_active` flag or `prompt_id` lookup isn't working correctly. Will investigate and fix the lookup in `SceneSidePanel` and atmosphere generation to ensure active prompts are found by type.

### 4. "Восстановить" button should restore from saved prompt template
Already implemented in `PublicationEditDialog` and `SceneSidePanel`. Will verify the logic pulls the correct prompt by type/channel and fills variables properly. If broken, fix the query.

### 5. Variable clicks should append at cursor position, not end of text
**File:** `src/components/prompts/PromptsPage.tsx` lines 391-401
- Add a ref to the `user_template` textarea
- On variable badge click, insert at `selectionStart` instead of appending to end

### 6. "Привязка к каналам" visible only for "Текст публикации"
**File:** `src/components/prompts/PromptsPage.tsx` lines 308-342
- Already implemented with `{form.type === 'post_text' && ...}` check. This is working. No change needed.

### Summary of Changes

| # | Fix | File(s) |
|---|-----|---------|
| 1 | Don't close dialog on save | `PromptsPage.tsx` |
| 2 | Hide max_tokens slider | `PromptsPage.tsx` |
| 3 | Verify prompt pulling in scenes/atmosphere | `SceneSidePanel.tsx`, edge functions |
| 4 | Verify "Восстановить" logic | Already works |
| 5 | Insert variables at cursor | `PromptsPage.tsx` |
| 6 | Channel binding visibility | Already works |

