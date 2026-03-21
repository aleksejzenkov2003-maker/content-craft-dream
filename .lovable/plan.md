
# План: починить motion для роликов без approved scene и перестать плодить новые motion

## Что нашёл

Для ролика `#11711 ... Orthodox` motion не добавился не потому, что UI не вызвал шаг, а потому что backend не нашёл подходящую сцену:

- в логах есть `No approved scene found for motion`
- в базе для `playlist_id = 994a...` и `advisor_id = f9d... (Orthodox)` есть только `waiting` scene без `scene_url`
- `prepareMotionStep` в `src/pages/Index.tsx` при отсутствии approved scene просто молча возвращает `true`
- `generate-video-heygen` умеет делать last-resort motion только если есть `sceneId`, то есть без approved scene он всегда уходит в статичное фото

Есть ещё 2 архитектурные проблемы:
1. В двух функциях используются разные endpoints для add_motion:
   - `add-avatar-motion` → `/v2/photo_avatar/add_motion`
   - `generate-video-heygen` → `/v1/talking_photo.add_motion`
2. Проверка текущего `motion_avatar_id` смотрит только “ID существует”, но не гарантирует, что motion уже готов к использованию, из-за чего возможен кейс с `missing image dimensions`.

## Что нужно сделать

### 1. Убрать зависимость motion от approved scene
Переделать подготовку motion так, чтобы она работала по цепочке источников:

```text
approved scene with scene_url
→ advisor.scene_photo_id
→ primary advisor photo
→ video/main fallback
```

То есть motion должен создаваться даже если сцена ещё не утверждена или вообще отсутствует.

### 2. Сделать единый motion-resolver
Вынести общую логику в один helper, который будут использовать и `add-avatar-motion`, и `generate-video-heygen`:

- найти лучший источник изображения
- проверить существующий `scene.motion_avatar_id`
- если его нет — проверить `video.motion_avatar_id`
- если валиден — переиспользовать
- если невалиден — очистить и создать новый
- если motion создаётся без scene — сохранять хотя бы в `videos.motion_avatar_id`

Так мы перестанем тратить кредиты повторно на один и тот же ролик.

### 3. Починить явный шаг в UI
В `Index.tsx` изменить `prepareMotionStep`:

- не завершать шаг фразой “No approved scene found for motion”
- вместо этого запускать motion по advisor photo fallback
- показывать понятные статусы:
  - `Шаг 0: Подготовка motion-аватара...`
  - `Motion аватар найден ✓`
  - `Motion аватар добавлен ✓`
  - `Motion создан из фото духовника ✓`

Если motion не удалось подготовить — оставлять текущий AlertDialog с выбором:
- продолжить без motion
- остановить генерацию

### 4. Привести add_motion к одному рабочему API
Использовать один и тот же endpoint и одинаковый формат запроса в обеих edge functions. Сейчас логика расходится, поэтому поведение “ручного” и “аварийного” создания motion отличается.

### 5. Проверять готовность motion, а не только существование
Усилить валидацию `motion_avatar_id`:

- смотреть не только наличие ID в HeyGen list
- проверять, что asset уже готов к использованию
- если motion ещё не готов — делать короткий bounded retry / wait-check
- если после короткой проверки не готов — не использовать его в генерации и показать осмысленную причину

Это устранит ситуацию, когда motion “есть в HeyGen”, но видео всё равно собирается без него.

### 6. Синхронизировать сохранение motion ID
После успешного создания:
- если есть scene → писать в `playlist_scenes.motion_avatar_id`
- всегда писать в `videos.motion_avatar_id`

Так повторная генерация сможет переиспользовать ранее созданный motion даже без сцены.

## Файлы

- `src/pages/Index.tsx`
- `supabase/functions/add-avatar-motion/index.ts`
- `supabase/functions/generate-video-heygen/index.ts`

## Результат

После правки motion будет работать в двух случаях:
- когда есть approved scene
- когда сцены нет, но есть фото духовника

Именно это сейчас ломает кейс `Orthodox`: система не находит approved scene и слишком рано сдается, вместо того чтобы создать/reuse motion по фото.

## Технически коротко

```text
Сейчас:
UI motion step -> ищет только approved scene
нет approved scene -> skip
backend last-resort motion -> требует sceneId
нет sceneId -> static photo

После исправления:
UI motion step -> approved scene OR advisor photo fallback
backend -> reuse valid motion from scene/video
если нет -> create once and save
```
