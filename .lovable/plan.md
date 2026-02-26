

## Problem

Questions are duplicated in the table because the grouping key is `${question_id}_${question_text}`. When one video for question_id 1042 has `question_rus = null` (falling back to `question_eng = "Can I kiss before marriage?"`), and another has `question_rus = "Можно ли целоваться до свадьбы?"`, two different keys are created — so the same question appears twice.

## Fix

**Group questions by `question_id` only**, not by question text. The text was added as a safety measure but it's causing real duplication. Since `question_id` is the actual identifier, grouping by it alone is correct.

### Changes

#### 1. `src/components/questions/QuestionsTable.tsx` — Fix unique key

Line 144: Change the unique key from composite to ID-only:
```typescript
// Before:
const uniqueKey = `${video.question_id}_${video.question_rus || video.question_eng || video.question || ''}`;

// After:
const uniqueKey = `${video.question_id}`;
```

Also update the data aggregation (line 161+) to merge `question_rus` and `question_eng` from all videos in the group — take the first non-null value:
```typescript
if (existing) {
  // Merge language fields if missing
  if (!existing.question_rus && video.question_rus) existing.question_rus = video.question_rus;
  if (!existing.question_eng && video.question_eng) existing.question_eng = video.question_eng;
  if (!existing.hook_rus && video.hook_rus) existing.hook_rus = video.hook_rus;
  // ...existing count logic...
}
```

#### 2. `src/pages/Index.tsx` — Update key parsing in handlers

All handlers (`onUpdateQuestion`, `onDeleteQuestion`, `onBulkUpdateStatus`, `onBulkDateUpdate`) currently parse `uniqueKey` by splitting on `_` to get `questionId` and `questionText`, then filter videos by both. Since the key is now just the ID:

```typescript
// Before:
const separatorIndex = uniqueKey.indexOf('_');
const questionId = parseInt(uniqueKey.substring(0, separatorIndex));
const questionText = uniqueKey.substring(separatorIndex + 1);
const videosToUpdate = allVideos.filter(v =>
  v.question_id === questionId &&
  (v.question_rus || v.question_eng || v.question || '') === questionText
);

// After:
const questionId = parseInt(uniqueKey);
const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
```

This applies to ~4 places in Index.tsx (lines 563-570, 591-598, 611-621, and the bulk date handler).

### Files to modify
- `src/components/questions/QuestionsTable.tsx` — change unique key to ID-only, merge language fields
- `src/pages/Index.tsx` — simplify key parsing in all question handlers

