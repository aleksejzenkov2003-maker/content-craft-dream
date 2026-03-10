

# Scene Side Panel Improvements

## Current Issues
1. The panel currently stores only one `scene_url` — no variant history
2. Prompt tab is minimal — no system prompt display, no restore/save buttons
3. Tab switching causes layout jumps (no fixed height)
4. It's unclear which prompt template was used for generation

## Plan

### 1. Database: Add `scene_variants` table
Create a new table to store multiple generated images per scene, following the existing `cover_thumbnails` pattern:

```sql
CREATE TABLE public.scene_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES public.playlist_scenes(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  prompt_used text,
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scene_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for scene_variants" ON public.scene_variants FOR ALL USING (true) WITH CHECK (true);
```

### 2. Edge Function: `generate-scene` — save variant instead of overwriting
- After generating an image, INSERT into `scene_variants` instead of just updating `playlist_scenes.scene_url`
- Mark the new variant as `is_selected = true` (unselect others)
- Still update `playlist_scenes.scene_url` to the latest for backward compatibility

### 3. SceneSidePanel — complete rework

**Layout (matches mockup):**
- Название плейлиста (read-only input)
- Духовник (read-only input)
- Tabs: "Генерация изображения" | "Промт"

**Image tab:**
- Variant indicators (1, 2, 3…) from `scene_variants` table
- 9:16 image preview with navigation arrows and star for selected
- Buttons: Сгенерировать, Загрузить (right side)
- Status badge overlay
- "Утвердить" button (full-width)

**Prompt tab:**
- Display the resolved prompt: system prompt (from active `scene` type prompt) + user template with variables filled in
- Editable textarea for the scene's `scene_prompt`
- "Восстановить" button — re-fetches the active prompt template and re-fills variables (playlist name, advisor name)
- "Сохранить" button — saves the current prompt text to `playlist_scenes.scene_prompt`

**Fixed panel height:**
- Set `min-h` on the tab content area so switching tabs doesn't change modal size

### 4. Hook changes: `usePlaylistScenes`
- Add `fetchVariants(sceneId)` to load variants from `scene_variants`
- Add `selectVariant(variantId, sceneId)` to mark a variant as selected and update `scene_url`

### 5. File changes summary
- **Migration**: new `scene_variants` table
- **`supabase/functions/generate-scene/index.ts`**: insert into `scene_variants` after generation
- **`src/hooks/usePlaylistScenes.ts`**: add variant fetching/selection
- **`src/components/scenes/SceneSidePanel.tsx`**: full rework per mockup — variants carousel, prompt display with restore/save, fixed height tabs

