

## Перенос Motion-настроек из видео в сцены

### Суть
Сейчас motion (engine, prompt, avatar_id) хранятся на каждом видео. Переносим их в `playlist_scenes` — motion привязывается к комбинации плейлист+адвайзор, а все видео этой пары автоматически используют готовый motion_avatar_id из сцены.

### Изменения по wireframe

Панель сцены (SceneSidePanel) получает **3 вкладки** вместо 2:
1. **Генерация изображения** — как сейчас
2. **Photo prompt** — переименованный "Промт"
3. **Motion prompt** — новая вкладка с textarea для motion prompt

Внизу панели — **3 кнопки в ряд**: Select motion engine | Подобрать Motion prompt | Сохранить

### Файлы и изменения

**1. Migration: добавить motion-поля в `playlist_scenes`**
```sql
ALTER TABLE public.playlist_scenes
  ADD COLUMN motion_type TEXT DEFAULT NULL,
  ADD COLUMN motion_prompt TEXT DEFAULT NULL,
  ADD COLUMN motion_avatar_id TEXT DEFAULT NULL;
```

**2. Edit: `src/components/scenes/SceneSidePanel.tsx`**
- Tabs: 2 → 3 (Генерация изображения / Photo prompt / Motion prompt)
- Вкладка "Motion prompt": Textarea для motion_prompt
- Footer: 3 кнопки в ряд — Select для motion_type (7 engines), "Подобрать Motion prompt" (пока placeholder), "Сохранить" (сохраняет motion_type + motion_prompt в playlist_scenes)
- Кнопка "Добавить движение" → вызов edge function `add-avatar-motion` (передаёт sceneId вместо videoId)
- Бейдж "Motion готов" если `scene.motion_avatar_id` есть

**3. Edit: `src/hooks/usePlaylistScenes.ts`**
- Добавить `motion_type`, `motion_prompt`, `motion_avatar_id` в интерфейс `PlaylistScene`

**4. Edit: `supabase/functions/add-avatar-motion/index.ts`**
- Принимать `sceneId` вместо `videoId`
- Читать сцену из `playlist_scenes`, получать advisor_id → фото
- Сохранять результат в `playlist_scenes.motion_avatar_id`

**5. Edit: `supabase/functions/generate-video-heygen/index.ts`**
- При поиске сцены (строки 114-127) выбирать также `motion_avatar_id`, `motion_type`
- Если у сцены есть `motion_avatar_id` — использовать его + `talking_style: 'expressive'`
- Убрать чтение `video.motion_avatar_id` (фолбэк оставить на случай старых данных)

**6. Edit: `src/components/videos/VideoSidePanel.tsx`**
- Убрать секцию "Настройка аватара (Motion)" (строки 415-497)
- Убрать state: motionType, motionPrompt, isAddingMotion и связанную логику

**7. Edit: `src/hooks/useVideos.ts`**
- motion_type, motion_prompt, motion_avatar_id можно оставить в интерфейсе (старые данные), но из UI они больше не управляются

### Логика генерации (обновлённая)

```text
generate-video-heygen:
  1. Найти approved сцену для playlist_id + advisor_id
  2. Если у сцены есть motion_avatar_id → использовать его
  3. Если нет → uploadTalkingPhoto как раньше
```

### Не меняется
- check-video-status, concat, субтитры, публикация
- Колонки motion_* в videos не удаляем (backward compat)

