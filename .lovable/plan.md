

## Changes Overview

Four modifications to the Questions block:

1. **Add "Взять в работу" button to the gear dropdown menu**
2. **Move "Импорт" button into the gear dropdown menu** (remove standalone button)
3. **Validate scene readiness + planned date before allowing "Взят в работу" status**
4. **Expand `triggerAutoGeneration` to include voiceover + atmosphere generation steps**

---

## Technical Plan

### File: `src/components/questions/QuestionsTable.tsx`

**A) Gear dropdown — add "Взять в работу" + move "Импорт"**

- Remove the standalone `<Button>` for Import from the toolbar
- Add `<DropdownMenuItem>` "Импорт" at the top of the gear dropdown (no selection required)
- Add `<DropdownMenuItem>` "Взять в работу" (requires selection, calls `onBulkUpdateStatus` with `'in_progress'`)

**B) Add new prop `onStartProduction` for triggering the full pipeline**

- New optional prop: `onStartProduction?: (uniqueKeys: string[]) => Promise<void>`
- The "Взять в работу" menu item will:
  1. Validate each selected question has a `planned_date` — show error if missing
  2. Validate each selected question has a `playlist_id` — show error "Сначала назначьте плейлист" if missing
  3. Check scenes exist for each playlist via a Supabase query to `playlist_scenes` table (status = approved/ready and scene_url is not null)
  4. If validation passes, call `onBulkUpdateStatus` then `onStartProduction`

**C) Update inline status change validation (`handleSaveQuestion`)**

- When setting `question_status` to `'in_progress'`, also check `playlist_id` and scene readiness
- Show specific error messages: "Не назначен плейлист" or "Нет готовой сцены для плейлиста"

### File: `src/pages/Index.tsx`

**D) Expand `triggerAutoGeneration`**

Current logic only generates covers and HeyGen videos. Add these steps before cover generation:

1. **Voiceover (ElevenLabs)** — for each video without `voiceover_url` and not `generating`:
   ```
   invoke generate-voiceover-for-video { videoId }
   ```
2. **Atmosphere background (Nano Banana)** — for each video without `atmosphere_url`:
   ```
   fetch generate-cover { videoId, step: 'atmosphere' }
   ```
3. **Cover overlay** — existing logic (fetch generate-cover with step: 'overlay'), but only after atmosphere is set
4. Remove direct HeyGen video generation from auto-trigger (it requires voiceover to finish first; polling handles it)

**E) Pass `onStartProduction` prop to `QuestionsTable`**

- Wire it to call `triggerAutoGeneration` for each selected uniqueKey after status update

### Validation Flow

```text
User clicks "Взять в работу"
  ├── Check planned_date exists → error if missing
  ├── Check playlist_id exists → error if missing  
  ├── Query playlist_scenes for matching playlist_id
  │   with scene_url IS NOT NULL → error if none found
  ├── Update status to 'in_progress'
  └── Trigger auto-generation pipeline:
       a) Generate voiceover (ElevenLabs)
       b) Generate atmosphere (Kie.ai)  
       c) Generate cover overlay (Image Magic)
       d) HeyGen video (triggered later via polling after voiceover ready)
```

