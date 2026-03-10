

## Changes to VideosTable

Based on the screenshot reference, here are the modifications:

### 1. Column layout to match screenshot

New column order (removing "Фон" and merging preview):

```text
☐ | ID↕ | Духовник↕ | Cover● | Озвучка● | Video● | Длина↕ | 🔊 | [thumbnail] | Обложка btn | Звук btn | Видео btn | Каналы
```

- Remove separate "Фон" (atmosphere) column — cover generation already includes atmosphere+overlay as one step
- Single thumbnail column shows the final cover (front_cover_url). Clicking it opens a preview popover (no regeneration)
- Remove the old "Превью" column header

### 2. Remove "Выгрузка" button

Remove the export XLSX button and its `handleExportXlsx` function from the toolbar.

### 3. Click on thumbnail = preview only

- Cover thumbnail click opens HoverCard/Popover preview (already works this way for cover)
- Video thumbnail in the video column: clicking the video icon opens a video player popover (already works)
- Neither triggers regeneration

### 4. Buttons trigger regeneration

Three separate buttons in each row:
- **Обложка** — calls `onGenerateCover(video)` (re-generates atmosphere + overlay)
- **Звук** — calls `onGenerateVoiceover(video)` (re-generates voiceover)
- **Видео** — calls `onGenerateVideo(video)` (re-generates HeyGen video)

When asset already exists, button still shows but triggers RE-generation. When generating, show spinner.

### 5. Standardized statuses

Replace current status configs with four unified statuses:
- **Pending** — gray dot
- **In progress** — yellow dot (maps from `generating`)
- **Ready** — green dot
- **Error** — red dot

Remove `atmosphere_ready` and `published` from status configs. Update `statusLabels` accordingly.

### File: `src/components/videos/VideosTable.tsx`

- Update grid template: `grid-cols-[40px_60px_150px_100px_100px_100px_70px_40px_80px_80px_80px_80px_40px]`
- Remove "Фон" column (atmosphere preview/button)
- Remove "Выгрузка" button and `handleExportXlsx` function, remove `xlsx` import
- Move "Импорт" into gear dropdown (consistent with Questions block)
- Update status configs to use `pending/generating/ready/error` with labels `Pending/In progress/Ready/Error`
- Cover thumbnail: click opens preview only (HoverCard, no onClick handler calling generation)
- Three action buttons: Обложка, Звук, Видео — each triggers respective generation callback
- Effective status resolution: if URL exists, show "Ready" regardless of backend status

