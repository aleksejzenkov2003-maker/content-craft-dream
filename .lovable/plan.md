
# План: починить auto-motion после замены сценариев

## Что сломалось

По коду видно 2 главные причины:

1. После замены матрицы сценариев пайплайн в `src/pages/Index.tsx` всё ещё проверяет старые ключи:
- `isEnabled('generate_video', 'voiceover')`
- `isEnabled('generate_video', 'motion')`
- `isEnabled('take_in_work', 'motion')`

Но в новом `useAutomationSettings.ts` таких связок уже нет:
- для единичного режима используется `side_video`, `voiceover`, `burn_subtitles`
- процесса `motion` вообще больше нет ни в `single`, ни в `bulk`

Итог: pre-warm motion сейчас фактически никогда не запускается.

2. `generate-video-heygen` сам motion больше не создаёт, а только пытается использовать уже готовый `motion_avatar_id`.  
То есть если pre-warm не сработал заранее, ролик уходит в HeyGen как обычное статичное talking photo.

Дополнительно вижу по данным БД, что у многих approved-сцен `motion_avatar_id` пустой, а в логах `generate-video-heygen` есть:
- `Scene found: NO Motion: NO`
- `talking_photo_id (fresh upload, no motion)`

Это подтверждает, что сейчас используется fallback без motion.

## Что нужно сделать

### 1. Привести pipeline к новым сценариям
Обновить `src/pages/Index.tsx`, чтобы проверки автоматизации использовали новые ключи сценариев:

- единичный запуск:
  - озвучка: `voiceover`
  - генерация видео: `side_video`
  - resize: `resize`
  - burn subtitles: `burn_subtitles`

- массовый запуск:
  - стартовый пакет: `take_in_work`
  - генерация видео: `side_video`

И отдельно вернуть motion как явный автоматический процесс внутри сценариев.

### 2. Вернуть process key `motion` в `useAutomationSettings.ts`
Добавить `motion` обратно в сценарии:

- `single`:
  - `side_video` → `heygen`, `motion`
  или
  - `voiceover`/ранний этап → `motion`
- `bulk`:
  - `take_in_work` → `voiceover`, `subtitles`, `atmosphere`, `cover_overlay`, `hook_overlay`, `motion`

Лучше оставить motion ранним шагом в bulk и до старта видео в single — так он успевает прогреться.

Также обновить подписи в preview сценариев:
- `motion: "Подготовка motion-аватара"`

### 3. Сделать единый helper для подготовки motion
Сейчас логика pre-warm дублируется в `Index.tsx`. Нужен один helper:
- найти approved scene по `playlist_id + advisor_id`
- если `motion_avatar_id` уже есть → ничего не делать
- если сцена есть и motion пустой → вызвать `add-avatar-motion`
- логировать результат
- возвращать статус: `created | skipped | no_scene | failed`

Это устранит расхождения между единичным и массовым запуском.

### 4. Усилить fallback в `generate-video-heygen`
Даже если pre-warm не успел:
- если `motion_enabled=true`
- если есть approved scene
- если `motion_avatar_id` пустой

то `generate-video-heygen` должен уметь сделать последнюю попытку создать motion перед статичным fallback.

Важно:
- без долгих циклов ожидания
- одна попытка создать / использовать
- если motion не готов, показать понятный `motionWarning`
- сохранить `motion_avatar_id` для следующего запуска

Это сделает систему устойчивой даже если ранний шаг пропущен.

### 5. Проверить выбор сцены для конкретного ролика
Нужно поправить lookup approved scene в `generate-video-heygen` и в pre-warm helper:
- явно сортировать запись
- брать именно утверждённую сцену с `scene_url`
- при нескольких сценах для одной пары использовать предсказуемый порядок

Сейчас по БД approved-сцены есть, но в логах иногда `Scene found: NO`, значит lookup нестабилен или ищет не ту запись.

### 6. Добавить диагностические логи
Чтобы подобное больше не искать вслепую, добавить понятные логи:
- какой сценарий активен
- с каким `buttonKey/processKey` проходит проверка
- найден ли scene для пары playlist/advisor
- был ли вызван `add-avatar-motion`
- вернулся ли `motion_avatar_id`
- почему произошёл fallback на static

## Файлы

Основные:
- `src/pages/Index.tsx`
- `src/hooks/useAutomationSettings.ts`
- `supabase/functions/generate-video-heygen/index.ts`

Возможное улучшение:
- вынести motion helper в отдельный util/hook, чтобы не дублировать код в `Index.tsx`

## Результат после исправления

- В новом сценарном режиме motion снова будет реально запускаться
- В массовом режиме motion будет прогреваться заранее
- В единичном режиме motion будет подготавливаться перед стартом видео
- Если ранний шаг не сработал, backend всё равно попробует использовать/создать motion перед fallback
- Для роликов вроде `Native Elder` система перестанет молча уходить в статичное видео без понятной причины

## Технические детали

```text
Проблемное место сейчас:
Index.tsx -> isEnabled('generate_video', 'motion')
useAutomationSettings.ts -> сценарии знают только side_video / take_in_work
=> всегда false
=> add-avatar-motion не вызывается
=> generate-video-heygen получает motion_avatar_id = null
=> fresh talking_photo without motion
```

```text
Предлагаемая схема:
Bulk:
take_in_work -> voiceover + subtitles + atmosphere + cover + motion
side_video -> heygen + resize + subtitles

Single:
voiceover -> voiceover + subtitles
side_video -> motion prewarm + heygen
resize -> resize
burn_subtitles -> burn subtitles
```
