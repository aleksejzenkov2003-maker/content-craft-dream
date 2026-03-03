

## Analysis of Current State vs Requirements

After reviewing the code and the reference screenshot, here's the status of each requirement:

### 1. Deduplication — Already Implemented ✅
- Database has a unique constraint on `(video_id, channel_id)` in the `publications` table
- `handlePublishVideo` in `Index.tsx` (lines 324-399) checks for existing pairs before inserting
- `bulkImport` in `usePublications.ts` filters duplicates client-side
- `addPublication` checks for existing pairs before inserting

No changes needed.

### 2. Fix Edit Form — Needs Investigation
The `PublicationEditDialog` appears functional but the user reports issues. Based on the reference screenshot and code review, the likely problems are:
- **Calendar/Select dropdowns closing the dialog**: The `onPointerDownOutside` fix is already applied. However, the `Select` components inside `Popover` may still cause issues with click propagation
- **The form works but may need UX improvements** — need clarification from the user on what exactly is broken

### 3. Auto Concat + Text Generation on Publish — Already Implemented ✅
- `handlePublishVideo` (lines 351-394) sets `needs_concat` status for channels with back covers
- Text generation is fire-and-forget for all new publications (lines 368-372)
- Auto-concat triggers when video URL is available (lines 376-394)
- `triggerAutoConcat` (lines 98-143) also runs after polling detects video is ready

No changes needed.

### 4. Publish Button Requires Text — Already Implemented ✅
- Button is disabled when `!pub.generated_text` (line 703)
- Tooltip shows "Сначала сгенерируйте текст" when text is missing (line 708)
- Bulk publish filters by `pub.generated_text` (line 324)

No changes needed.

---

## Remaining Issue: Table Layout (from Reference Screenshot)

The reference image shows the status columns should display **icons** (video camera for concat, text document for text, and status text for publication) rather than plain text. The current code shows "Готово" / "—" which matches partially but lacks the visual icons shown in the reference.

## Plan

Since items 1, 3, and 4 are already implemented, the main question is about item 2 — the edit form. I need to clarify what specifically is broken with the form.

### Changes to implement:
1. **Clarify edit form issue** — ask the user what specifically needs fixing
2. **Minor table UX** — Add visual status icons (camera icon for concat status, document icon for text status) to match the reference screenshot more closely

