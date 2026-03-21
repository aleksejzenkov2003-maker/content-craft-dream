

# Починить motion: правильная валидация + ожидание готовности

## Корневые причины (из логов)

1. **Валидация по неправильному API**: Motion аватары создаются через `/v2/photo_avatar/add_motion`, но проверяются через `/v1/talking_photo.list`. Это **разные списки** — motion ID не находится → очищается из БД → создаётся новый (тратятся кредиты) → или падает с "insufficient credit".

2. **Недостаточно кредитов HeyGen**: `Insufficient credit. This operation requires 'api' credits.` — motion creation стоит денег, а баланс исчерпан. Система тратила кредиты на повторное создание motion из-за ложной невалидации.

3. **Нет ожидания после создания**: Motion создаётся, но HeyGen нужно время на обработку. Без паузы → "missing image dimensions" → fallback на static.

## Что делаем

### 1. Исправить валидацию — использовать `/v2/photo_avatar/{id}` или `/v2/avatars`

Вместо `/v1/talking_photo.list` (где motion не появляется) использовать правильный HeyGen endpoint:
- `GET /v2/photo_avatar/generation/{id}` — проверяет статус конкретного photo avatar
- Возвращает `status: "completed"` или `"in_progress"`

Это исправит ложное удаление валидных motion ID из БД.

**Файлы**: `add-avatar-motion`, `generate-video-heygen` — заменить `validateMotionId` на вызов `/v2/photo_avatar/generation/{id}`.

### 2. Добавить ожидание готовности motion (bounded polling)

После создания motion или при обнаружении `status: "in_progress"`:
- Делать до 6 проверок с интервалом 5 секунд (30 секунд макс)
- Если `completed` → использовать
- Если после 30 сек всё ещё `in_progress` → показать AlertDialog пользователю

**В `prepareMotionStep` (Index.tsx)**: после вызова `add-avatar-motion` — поллить статус через новый endpoint `check-motion-status` (или inline в `add-avatar-motion`).

**В `generate-video-heygen`**: перед использованием motion_avatar_id — быстрая проверка статуса. Если `in_progress` → 3 попытки по 5 секунд. Если не готов → fallback.

### 3. Показывать ошибку кредитов явно

Если `add-avatar-motion` или last-resort возвращает "insufficient_credit":
- Toast: "Недостаточно кредитов HeyGen для motion. Пополните баланс."
- В AlertDialog: "Кредиты HeyGen исчерпаны. Продолжить без motion?"

### 4. Прекратить ложное удаление motion ID

Убрать логику `motion_avatar_id not found in HeyGen — clearing from DB` из `generate-video-heygen`. Вместо этого — проверять статус через v2 API. Только если API явно вернёт 404 → тогда очищать.

## Файлы

- `supabase/functions/add-avatar-motion/index.ts` — новая функция `validateMotionId` через v2 API + polling после создания
- `supabase/functions/generate-video-heygen/index.ts` — заменить валидацию на v2 API + bounded wait
- `src/pages/Index.tsx` — добавить toast для insufficient_credit, polling статуса после создания

## Результат

- Motion ID перестанут ложно удаляться из БД (экономия кредитов)
- После создания motion система дождётся готовности (до 30 сек)
- При нехватке кредитов — явное уведомление пользователю
- Ролики будут получать motion, если он физически готов в HeyGen

