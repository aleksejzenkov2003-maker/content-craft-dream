

## Plan: Widen Video Side Panel with Tabbed Layout

### Problem
The side panel is too narrow (450-550px) to display the full generation pipeline (Background → Cover → Video) side by side as shown in the reference image. The atmosphere prompt is hidden in a collapsible section instead of being a proper tab.

### Changes

#### `src/components/videos/VideoSidePanel.tsx`

1. **Widen the panel**: Change `w-[450px] sm:w-[550px]` to `w-[700px] sm:w-[800px]` on line 273.

2. **Add tabs "Генерация изображения" / "Промт"** inside the cover generation section (replacing the current collapsible prompt):
   - **Tab "Генерация изображения"** (default): Contains the generation buttons (Step 1: Background, Step 2: Cover) and the 3-column carousel layout showing Background, Cover, and Video side by side (as in the reference image).
   - **Tab "Промт"**: Contains the atmosphere prompt textarea (currently in the collapsible).

3. **3-column pipeline layout**: Change the current `grid-cols-2` carousel (lines 494-612) to `grid-cols-3`, adding a third column for the Video preview/player. Move the video player from the separate "Видео" section below into this third column, so all three steps (Background → Cover → Video) are visible together horizontally.

4. **Add Step 3 button**: Add a third generation button "Шаг 3: Видео" alongside the existing two, making the grid `grid-cols-3` for the buttons (lines 462-491).

5. **Import Tabs**: Add `Tabs, TabsList, TabsTrigger, TabsContent` import from `@/components/ui/tabs`.

### Structure After Change

```text
┌──────────────────────────────────────────────────┐
│ Header                                           │
├──────────────────────────────────────────────────┤
│ Channels / Answer / Date / Voiceover (unchanged) │
├──────────────────────────────────────────────────┤
│ [Генерация изображения] [Промт]  ← tabs          │
│                                                  │
│ Tab 1: [Шаг 1: Фон] [Шаг 2: Обложка] [Шаг 3:]  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ 9:16    │  │ 9:16    │  │ 9:16    │          │
│  │ Фон     │  │ Обложка │  │ Видео   │          │
│  │ carousel│  │ carousel│  │ player  │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│  Status selectors                                │
│                                                  │
│ Tab 2: Textarea with atmosphere prompt           │
├──────────────────────────────────────────────────┤
│ Meta fields (URLs, duration)                     │
└──────────────────────────────────────────────────┘
```

### Files
- `src/components/videos/VideoSidePanel.tsx` — all changes in this single file

