

# Замена матрицы автоматизации на два предустановленных сценария

## Суть

Убрать текущую панель чекбоксов (ButtonActionsSettings) и заменить на два фиксированных сценария — "Единичный" и "Массовый" — с переключением в настройках и возможностью просмотра содержимого каждого сценария.

## Изменения

### 1. `app_settings` — новый ключ `action_mode`

Миграция: `INSERT INTO app_settings (key, value) VALUES ('action_mode', 'single')` — значения `single` или `bulk`.

### 2. `useAutomationSettings.ts` — полная переделка

Вместо чтения матрицы из БД — читать один ключ `action_mode` из `app_settings` и определять `isEnabled(buttonKey, processKey)` по хардкоду двух сценариев:

**Единичный (`single`)**:
| Кнопка | Процессы |
|---|---|
| `side_step1` | `atmosphere` |
| `side_cover` | `cover_overlay`, `hook_overlay` |
| `voiceover` (новый) | `voiceover`, `subtitles` |
| `side_video` | `heygen` |
| `resize` (новый) | `resize` |
| `burn_subtitles` (новый) | `subtitles` |
| `prepare_publish` | `create_publication`, `concat`, `generate_text` |
| `publish` | `publish_social` |

**Массовый (`bulk`)**:
| Кнопка | Процессы |
|---|---|
| `take_in_work` | `voiceover`, `subtitles`, `atmosphere`, `cover_overlay`, `hook_overlay` |
| `side_video` | `heygen`, `resize`, `subtitles` |
| `prepare_publish` | `create_publication`, `concat`, `generate_text` |
| `publish` | `publish_social` |

Функция `isEnabled(button, process)` проверяет хардкод активного сценария. Все остальные комбинации → `false`.

### 3. `VideoFormatSettings.tsx` — секция "Формат действий"

Добавить новую секцию (как на скрине) с RadioGroup:
- "Единичный режим" — каждый ролик запускается отдельно
- "Массовый режим" — параллельные действия над роликами

При выборе → `upsert` в `app_settings` ключ `action_mode`.

Кнопка "Показать сценарий" → раскрывает read-only таблицу с описанием шагов (Кнопка → Действия).

### 4. `SettingsPage.tsx` — убрать таб "Управление действиями кнопок"

Удалить секцию `buttons` и `ButtonActionsSettings`. Оставить только `api` и `video_format`.

### 5. `AutomationPage.tsx` — показывать превью текущего сценария

Вместо матрицы чекбоксов — показать read-only описание текущего активного сценария (таблица: Кнопка → Действия) + ссылку на настройки для переключения.

### 6. Файлы

- **Переделка**: `src/hooks/useAutomationSettings.ts`, `src/components/settings/VideoFormatSettings.tsx`, `src/components/settings/SettingsPage.tsx`, `src/pages/AutomationPage.tsx`
- **Удаление**: `src/components/settings/ButtonActionsSettings.tsx` (больше не нужен)
- **Миграция**: INSERT `action_mode` в `app_settings`

