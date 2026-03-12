

## Два исправления

### 1. Фото духовника не обновляются в карточке

**Причина**: В `AdvisorsGrid.tsx` превью «Основное фото» и «Миниатюра» (строки 241, 255) используют `getScenePhoto(selectedAdvisorLive!)` — объект из БД. Когда пользователь меняет фото в дропдауне (строки 320, 333), обновляется `editFormData`, но `selectedAdvisorLive` остаётся со старыми значениями `scene_photo_id` / `thumbnail_photo_id`. Превью не меняется до нажатия «Сохранить».

**Исправление**: Заменить `selectedAdvisorLive!` на `selectedAdvisor` (который уже содержит merged данные из `editFormData`) в вызовах `getScenePhoto` и `getThumbnailPhoto` для превью-блоков (строки 241-242 и 255-257).

### 2. Первоначальный размер видео в карточке генерации

**Причина**: Сейчас в «Мета» блоке показан только размер финального видео (`video_path` или `heygen_video_url`). Нет информации об оригинальном размере HeyGen-видео для сравнения.

**Исправление** в `VideoSidePanel.tsx`:
- Добавить `originalSizeBytes` state — размер `heygen_video_url` (оригинал до уменьшения битрейта)
- Проводить probe размера `heygen_video_url` параллельно с текущим probe финального видео
- В блоке «Мета» (строки 566-571) показать строку «Оригинал HeyGen» с размером и коэффициентом сжатия (например: `45.2 MB → 12.1 MB (×3.7)`)

### Файлы
- `src/components/advisors/AdvisorsGrid.tsx` — 2 замены `selectedAdvisorLive!` → `selectedAdvisor`
- `src/components/videos/VideoSidePanel.tsx` — новый state + probe + отображение в мета-блоке

