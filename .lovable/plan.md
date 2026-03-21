

# Motion: явный шаг с уведомлениями + переиспользование

## Корневая причина

По логам видно: `add-avatar-motion` создаёт motion ID (`6a01fd09503b47d2bcc200d109548ac9`), но HeyGen возвращает "**missing image dimensions**" при попытке использовать — motion ещё обрабатывается. Система делает 5 попыток и падает на статику. Каждый раз создаётся **новый** motion вместо переиспользования существующего.

## Что делаем

### 1. Явный шаг motion с подтверждением ошибки (Index.tsx)

В `handleGenerateVideo` (single pipeline):
- Показывать toast "Шаг 0: Проверка motion-аватара..."
- Если `scene.motion_avatar_id` уже есть → валидировать его через HeyGen API (`/v1/talking_photo.list`). Если валиден → toast.success "Motion аватар готов ✓", пропустить создание
- Если нет → создать через `add-avatar-motion`, toast.success "Motion добавлен ✓"
- **При ошибке**: показать **AlertDialog** "Motion не удался: [причина]. Продолжить генерацию без motion?" с кнопками Да/Нет
  - Да → продолжить pipeline без motion
  - Нет → прервать pipeline

### 2. Переиспользование существующих motion (add-avatar-motion + generate-video-heygen)

**`add-avatar-motion`**: Перед загрузкой нового talking_photo — проверять, есть ли уже `motion_avatar_id` на сцене. Если есть — вызвать HeyGen `/v1/talking_photo.list` и проверить, что ID всё ещё существует. Если да → вернуть его без повторного создания.

**`generate-video-heygen`**: Перед использованием `motion_avatar_id` — сделать быструю проверку через HeyGen API. Если ID невалиден (missing dimensions) → очистить его из сцены и создать заново, а не просто fallback на static.

### 3. Новый edge function: validate-motion (или inline в generate-video-heygen)

Добавить helper-функцию для валидации motion_avatar_id:
```
GET https://api.heygen.com/v1/talking_photo.list
→ найти в списке нужный ID → проверить что он ready
```
Если не найден или не ready → вернуть `{ valid: false }`.

### 4. UI для AlertDialog при ошибке motion

В `Index.tsx` добавить state + AlertDialog:
```
const [motionError, setMotionError] = useState<{ message: string; videoId: string } | null>(null);
```
При ошибке motion → `setMotionError(...)` → показать AlertDialog → пользователь решает продолжить или нет.

## Файлы

- **`src/pages/Index.tsx`**: явный шаг motion + AlertDialog + ожидание решения пользователя
- **`supabase/functions/add-avatar-motion/index.ts`**: проверка существующего motion_avatar_id перед созданием нового
- **`supabase/functions/generate-video-heygen/index.ts`**: валидация motion_avatar_id через HeyGen API перед использованием, очистка невалидных ID

## Результат

- Motion — явный шаг с уведомлениями (не молчаливый)
- Ошибка motion → пользователь решает продолжить или нет
- Существующие motion переиспользуются, а не пересоздаются каждый раз ($1 за каждый)
- Невалидные motion_avatar_id автоматически очищаются из БД

