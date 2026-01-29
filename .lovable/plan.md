
## Plan: Restructure Questions Table and Auto-create Videos for All Advisors

### Overview
This plan addresses two key changes:
1. Restructure the Questions table columns to match the exact layout from the reference image
2. Implement automatic video creation for each advisor when a new question is added

---

### Part 1: Questions Table Column Restructure

**Current state:** The table has 9 columns with circle checkboxes used for both bulk actions and selection.

**Target state:** The table will have distinct column purposes:

| # | Column | Purpose |
|---|--------|---------|
| 1 | Circle (O) | Bulk action selection (delete, etc.) |
| 2 | ID | Question number |
| 3 | Безопасность | Safety score badge |
| 4 | Актуальность | Relevance score number |
| 5 | Вопрос к духовнику рус | Question text in Russian |
| 6 | Planned publication date | Date + time display |
| 7 | Статус | Square checkbox for video tab filtering |
| 8 | Вопрос к духовнику eng | Question text in English |

**File changes:**
- `src/components/questions/QuestionsTable.tsx`:
  - Separate bulk delete selection (circle) from video filter selection (square checkbox)
  - Add separate state for `bulkDeleteIds` (circle checkboxes for mass deletion)
  - Keep existing `localSelectedIds` for video filtering (square checkboxes in Status column)
  - Update grid template to match new column order
  - Circle checkbox triggers bulk delete actions
  - Square checkbox in Status column triggers `onSelectionChange` for video filtering

---

### Part 2: Auto-create Videos for All Advisors

**Current state:** When a question is added, only one video record is created.

**Target state:** When a question is added, one video record per advisor is automatically created.

**Logic flow:**
```text
User adds question
     |
     v
Fetch all active advisors
     |
     v
Create N video records (1 per advisor)
with the same question_id, question text, safety_score
     |
     v
Videos tab shows grouped view:
  Question 1
    - Video for Advisor A
    - Video for Advisor B
    - Video for Advisor C
    ...
```

**File changes:**
- `src/pages/Index.tsx`:
  - Modify `onAddQuestion` handler to:
    1. Get all advisors from state
    2. Create video records for each advisor with the new question data
    3. Assign unique `video_number` for each (question_id * 100 + advisor_index)

---

### Technical Details

**QuestionsTable.tsx changes:**
1. Add new state: `const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([]);`
2. Column 1: Circle checkbox controls `bulkDeleteIds` for deletion
3. Column 7: Square checkbox controls `localSelectedIds` for video filtering
4. Update grid: `grid-cols-[40px_60px_110px_70px_1fr_160px_50px_1fr]`
5. Show bulk delete toolbar when `bulkDeleteIds.length > 0`
6. Show "Go to videos" when `localSelectedIds.length > 0`

**Index.tsx changes:**
1. Update `onAddQuestion` callback:
```typescript
onAddQuestion={async (data) => {
  // Create one video per advisor
  for (const advisor of advisors) {
    await addVideo({
      question_id: data.question_id,
      question: data.question,
      question_rus: data.question,
      safety_score: data.safety_score,
      advisor_id: advisor.id,
      video_number: data.question_id * 100 + (advisors.indexOf(advisor) + 1),
    });
  }
}}
```

---

### UI Behavior Summary

| Action | Trigger | Result |
|--------|---------|--------|
| Click circle checkbox | Column 1 | Add to bulk delete selection |
| Click square checkbox | Column 7 (Status) | Filter videos tab to show videos for this question |
| Select all circles | Header checkbox | Select all for deletion |
| Click row | Anywhere except checkboxes | Open side panel for editing |
| Add new question | Dialog | Creates N videos (one per advisor) |

---

### Files to Modify
1. `src/components/questions/QuestionsTable.tsx` - Column restructure and dual checkbox logic
2. `src/pages/Index.tsx` - Auto-create videos for all advisors when question is added
