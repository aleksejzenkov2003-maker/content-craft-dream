

## Диагноз

Из логов видео `de984e33` (Rabbi) видна точная последовательность:

1. Motion создан успешно: `auto_motion_created`, ID `98757c14...`
2. Первый запрос к HeyGen с этим motion ID → **отклонён** с ошибкой `missing image dimensions`
3. Система очистила motion и пересоздала обычный `talking_photo` → видео создалось **без motion**
4. В `activity_log` записано `motion_used: true` — **ложная запись**, т.к. реально motion не использован

**Корневая причина**: HeyGen не успевает обработать только что созданный motion avatar. Между `add_motion` и `video/generate` проходит менее секунды — avatar ещё не готов.

## План исправления

### 1. Добавить задержку/polling после создания motion avatar

**Файл**: `supabase/functions/generate-video-heygen/index.ts`

После успешного `add_motion` (получен `newMotionId`), добавить ожидание 5-8 секунд перед использованием этого ID в `video/generate`. HeyGen нужно время на обработку изображения.

```text
add_motion → получен ID
  ↓
  wait 6 seconds        ← НОВОЕ
  ↓
video/generate с motion ID
```

### 2. Установить motionWarning при retry по "missing image dimensions"

Сейчас при retry из-за `missing image dimensions` переменная `motionWarning` не устанавливается — пользователь не видит предупреждения. Добавить:

```typescript
motionWarning = 'Motion не применён: провайдер не успел обработать аватар';
```

### 3. Исправить activity_log после retry

Сейчас после retry `effectiveMotionAvatarId` остаётся непустым (он не обнуляется в коде), поэтому лог записывает `motion_used: true`. Нужно обнулить `effectiveMotionAvatarId` при retry:

```typescript
effectiveMotionAvatarId = null; // ← добавить в блок retry
```

### Итого изменения

| Файл | Что меняется |
|---|---|
| `generate-video-heygen/index.ts` | 1) `await delay(6000)` после `add_motion` 2) `motionWarning` при retry 3) обнуление `effectiveMotionAvatarId` при retry |

Одна edge function, три точечных правки. UI-код не затрагивается — toast-уведомления уже работают.

