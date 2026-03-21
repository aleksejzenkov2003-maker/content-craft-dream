

# Панель активных процессов на дашборде

## Что строим

Новый компонент `ActiveProcesses` на дашборде, показывающий все видео в активных состояниях (генерация, постобработка, озвучка, обложка) с пошаговой историей из `activity_log`. Каждый процесс раскрывается, показывая таймлайн шагов (motion, voiceover, heygen, resize, subtitles) с результатами и ошибками. Клик по видео переводит на вкладку "Ролики" с открытием боковой панели.

## Структура

### 1. Новый компонент `src/components/dashboard/ActiveProcesses.tsx`

Карточка с заголовком "Активные процессы" и авто-обновлением каждые 10 секунд.

**Данные**: запрос к `videos` где `generation_status IN ('generating', 'processing')` или `reel_status = 'generating'` или `voiceover_status = 'generating'` или `cover_status = 'generating'`. Плюс join с `activity_log` по `entity_id`.

**UI каждого процесса**:
```text
┌─────────────────────────────────────────────────┐
│ 🟡 Can I divorce... — Orthodox        [Перейти] │
│ Статус: HeyGen генерация · Попытка #1           │
│                                                  │
│ ▼ История шагов                                  │
│   ✅ 10:07 voiceover_generated  (6.9s)          │
│   ✅ 10:07 add_avatar_motion    (скип)          │
│   ⚠️ 10:07 motion_not_ready                     │
│   🔄 10:07 heygen_video_started                  │
│      └─ motion_used: false                       │
│      └─ warning: Motion не применён              │
└─────────────────────────────────────────────────┘
```

- Цветные иконки по статусу шага: ✅ success, ⚠️ warning/fallback, ❌ error, 🔄 in progress
- Раскрытие деталей каждого шага (input/output JSON) — переиспользуем паттерн из `StepDebugger`
- Кнопка "Перейти" → `setActiveTab('videos')` + `setViewingVideoId(id)` + `setShowSidePanel(true)`

### 2. Также показывать недавно завершённые (последние 5)

Под активными — секция "Недавно завершённые" с последними 5 видео, у которых `generation_status = 'ready'` и есть записи в `activity_log` за последние 24 часа. Позволяет проверить, всё ли прошло штатно.

### 3. Интеграция в дашборд (`Index.tsx`)

Добавить `<ActiveProcesses />` после блока `StatsCard` на дашборде. Передать callback `onNavigateToVideo` для навигации.

### 4. Хук `useActiveProcesses.ts`

- Запрос активных видео + их `activity_log` записей
- Группировка логов по `entity_id` и сортировка по `created_at`
- Авто-рефреш каждые 10 секунд (для активных)
- Realtime подписка на `videos` для мгновенного обновления статусов

## Файлы

- **Создать**: `src/components/dashboard/ActiveProcesses.tsx`, `src/hooks/useActiveProcesses.ts`
- **Изменить**: `src/pages/Index.tsx` — добавить компонент на дашборд, передать навигацию

