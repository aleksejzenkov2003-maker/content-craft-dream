

## Changes to VideoSidePanel

### 1. Reduce modal scale
Change `UnifiedPanel` width and add CSS scaling so all content fits without scrolling. Use `width="lg"` instead of `"xl"` and reduce internal spacing/font sizes.

### 2. Reorder blocks to match screenshot business flow

**New order:**
1. **Tabs** (Генерация изображения / Промт / Ответ духовника) — moved to TOP
2. **Выбор каналов публикации** + **Готовность** checkbox row
3. **"Отправить на подготовку к публикации"** button
4. **Озвучка** section (audio player + regenerate)
5. **Subtitle burning** (kept inside voiceover section)
6. **Links section** (new): Ссылка на аудио, Ссылка на обложку, Ссылка на субтитры, Ссылка на видео
7. **Длительность видео**, **Размер видео**

Remove: publication date picker (moved to questions), cover/video status dropdowns (replaced by overlay badges), editable Cover URL input (replaced by read-only link).

### 3. Status badges overlaid on images

Each of the 3 columns (Фон, Обложка, Видео) gets a status badge at the bottom of the image:
- **Pending** — gray badge
- **In progress** — yellow badge  
- **Ready** — green badge
- **Error** — red badge

Status resolution: if URL exists → Ready, if status is `generating` → In progress, if `error` → Error, else Pending.

### 4. Add links section at bottom

```text
Ссылка на аудио      [voiceover_url or —]
Ссылка на обложку    [front_cover_url or —]
Ссылка на субтитры   [subtitle file link or —]
Ссылка на видео      [video_path or heygen_video_url or —]
Длительность видео   1:12 секунд
Размер видео         — (not tracked yet, show —)
```

Links are clickable (open in new tab).

### 5. Fix terminology

- "Фон атмосфера сгенерирован" → "Фон сгенерирован"
- "Шаг 1: Фон" → "Шаг 1. ФОН" (match screenshot)
- "Шаг 2: Обложка" → "Шаг 2. Обложка"
- "Шаг 3: Видео" → "Шаг 3. Видео"
- Button labels: match screenshot exactly

### 6. Video generation uses advisor's scene photo

Already handled by existing logic (memory confirms scene_photo_id priority). No code change needed — just verify the generation callback passes the correct photo.

### File: `src/components/videos/VideoSidePanel.tsx`
Full rewrite of the component layout with reordered sections, status overlays on images, links section, and reduced scale.

