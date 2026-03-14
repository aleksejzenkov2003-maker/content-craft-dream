

## Add Motion для Avatar III в карточке видео

### Суть
Добавить в VideoSidePanel секцию "Настройка аватара" (только для режима v3), где можно:
1. Выбрать **motion engine** из списка (consistent, expressive, consistent_gen_3, hailuo_2, veo2, seedance_lite, kling)
2. Указать **motion prompt** (текст описания движений)
3. Нажать "Добавить движение" — вызов API `/v2/photo_avatar/add_motion`, получить новый `talking_photo_id` с motion
4. Сохранить этот ID → использовать при генерации видео вместо обычного `talking_photo_id`

Motion-аватар создаётся один раз ($1), затем переиспользуется. Каждое видео — $1/мин.

### Изменения

**1. Migration: новые поля в `videos`**

```sql
ALTER TABLE public.videos
  ADD COLUMN motion_type TEXT DEFAULT NULL,
  ADD COLUMN motion_prompt TEXT DEFAULT NULL,
  ADD COLUMN motion_avatar_id TEXT DEFAULT NULL;
```

- `motion_type` — выбранный engine (consistent, expressive, etc.)
- `motion_prompt` — описание движений
- `motion_avatar_id` — результат add_motion API, переиспользуемый talking_photo_id

**2. Новый Edge Function: `add-avatar-motion`**

Вызывает HeyGen API:
```
POST https://api.heygen.com/v2/photo_avatar/add_motion
{ "id": talkingPhotoId, "prompt": motionPrompt, "motion_type": motionType }
```
Получает новый avatar/look ID → сохраняет в `videos.motion_avatar_id`.

Шаги:
- Получить видео + адвайзора из БД
- Загрузить фото как talking_photo (как в generate-video-heygen)
- Вызвать add_motion
- Сохранить `motion_avatar_id` в videos

**3. Правка Edge Function: `generate-video-heygen`**

Перед генерацией проверить: если у видео есть `motion_avatar_id` и режим v3 — использовать его вместо свежезагруженного `talkingPhotoId`:

```typescript
const talkingPhotoIdFinal = video.motion_avatar_id || talkingPhotoId;
```

Также добавить `talking_style: 'expressive'` если есть motion.

**4. UI: секция в VideoSidePanel**

После кнопок "Шаг 1/2/3" добавить блок "Настройка аватара" (показывать только если heygen_mode === 'v3'):
- Select: motion_type (7 вариантов)
- Input: motion_prompt (с дефолтом "The person gestures naturally...")
- Кнопка "Добавить движение" → вызов edge function
- Статус: если `motion_avatar_id` есть — показать зелёный бейдж "Motion готов"

**5. Обновить Video interface** в `useVideos.ts`

Добавить 3 новых поля: `motion_type`, `motion_prompt`, `motion_avatar_id`.

### Файлы
1. **Migration** — 3 колонки в videos
2. **New**: `supabase/functions/add-avatar-motion/index.ts`
3. **Edit**: `supabase/config.toml` — зарегистрировать функцию
4. **Edit**: `supabase/functions/generate-video-heygen/index.ts` — использовать motion_avatar_id
5. **Edit**: `src/hooks/useVideos.ts` — добавить поля в интерфейс
6. **Edit**: `src/components/videos/VideoSidePanel.tsx` — UI блок настройки аватара

### Не меняется
- check-video-status, concat, субтитры, публикация — всё после генерации идёт как раньше

