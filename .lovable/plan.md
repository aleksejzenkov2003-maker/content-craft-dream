
Проблема уже найдена: сейчас ломается не баланс и не настройка режима, а рассинхрон статусов готовности motion между двумя backend-функциями.

## Что именно происходит

По логам у тебя один и тот же motion ID:
- `add_avatar_motion` пишет `ready: true`
- сразу после этого `generate-video-heygen` видит статус `pending`
- затем HeyGen отвечает `missing image dimensions`
- система делает `motion_fallback_to_static`

То есть motion формально создан, но фактически ещё не готов для генерации видео.

## Корневая причина

В `add-avatar-motion` функция `validateMotionIdV2()` считает валидным любой неизвестный статус:
- `completed` / `active` → ok
- `in_progress` / `processing` → not ready
- все остальные, включая `pending` → тоже ok

Из-за этого:
1. motion создаётся
2. HeyGen возвращает `pending`
3. `add-avatar-motion` ошибочно считает это “готово”
4. `prepareMotionStep` пропускает дальше
5. `generate-video-heygen` пытается использовать motion слишком рано
6. получает ошибку и падает в static fallback

## Что нужно исправить

### 1. Сделать единую нормальную проверку готовности motion
В обеих функциях:
- `supabase/functions/add-avatar-motion/index.ts`
- `supabase/functions/generate-video-heygen/index.ts`

Нужно считать **готовыми только**:
- `completed`
- `active`

А статусы:
- `pending`
- `in_progress`
- `processing`
- любые неизвестные промежуточные

считать **ещё не готовыми**, а не валидными.

### 2. Исправить polling в `add-avatar-motion`
Сейчас функция может вернуть:
```json
{ success: true, motionAvatarId, ready: true }
```
хотя HeyGen ещё в `pending`.

Нужно:
- ждать, пока статус станет именно `completed`/`active`
- если за лимит ожидания не дошёл → вернуть `success: true`, но `ready: false`
- не говорить UI, что motion готов, если он ещё `pending`

### 3. В `prepareMotionStep` учитывать `ready: false`
В `src/pages/Index.tsx` сейчас успешный ответ от `add-avatar-motion` почти всегда трактуется как “можно продолжать”.

Нужно изменить логику:
- если `motionData.success && motionData.ready === true` → продолжаем генерацию
- если `motionData.success && motionData.ready === false` → показать AlertDialog:
  - “Motion создан, но ещё обрабатывается. Подождать и попробовать позже или продолжить без motion?”
- не стартовать видео сразу, если цель — “motion наверняка”

### 4. Убрать ложную “успешность” в toast/логах
Сейчас UI пишет что motion добавлен успешно, хотя по факту он ещё `pending`.

Нужно разделить сообщения:
- готов: `Motion аватар готов ✓`
- создан, но не готов: `Motion создан, но ещё обрабатывается`
- fallback: только если пользователь явно согласился продолжать без motion

### 5. Усилить защиту в `generate-video-heygen`
Даже после frontend-проверки backend должен оставаться строгим:
- перед запуском видео повторно проверять motion status
- если статус `pending` → ждать дольше, чем сейчас
- если не дошёл до `completed/active` → не маскировать это как “motion_used: true”

Сейчас в логе одновременно:
- `motion_used: true`
- `motion_warning: Motion не применён...`

Это вводит в заблуждение. Нужно логировать фактически:
- `motion_requested`
- `motion_applied`
- `motion_fallback`

## Ожидаемый результат после исправления

После фикса пайплайн будет таким:
1. создаём motion
2. ждём реальной готовности
3. только потом запускаем генерацию видео
4. если motion ещё не готов — не врём в UI и не запускаем ролик как будто всё ок
5. fallback в static будет только осознанным сценарием, а не из-за ложного `ready`

## Файлы для правки

- `supabase/functions/add-avatar-motion/index.ts`
- `supabase/functions/generate-video-heygen/index.ts`
- `src/pages/Index.tsx`

## Коротко: почему “опять не работает”

Потому что система сейчас считает статус `pending` как готовый motion, а HeyGen — нет.  
То есть у нас не проблема создания motion, а проблема неправильной интерпретации статуса готовности перед запуском видео.
