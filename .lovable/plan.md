

## Plan: Button Actions & Automation Settings

### Overview

Add a configurable automation system to the Settings page. Each button action in the app will have a list of sub-processes that can be toggled on/off. The config is stored in a new DB table and read at runtime to skip disabled steps.

### Automation Buttons & Their Processes

Based on the codebase analysis, here are the 4 automation entry points:

```text
┌─────────────────────────┬──────────────────┬─────────────────────────┬──────────────────────────────────────────────┐
│ Button                  │ Section          │ Pre-check               │ Processes                                    │
├─────────────────────────┼──────────────────┼─────────────────────────┼──────────────────────────────────────────────┤
│ Взят в работу           │ Вопросы          │ —                       │ • Генерация аудио и субтитров                │
│                         │                  │                         │ • Генерация фона для обложки                 │
│                         │                  │                         │ • Склейка обложки с миниатюрой + заголовок   │
│                         │                  │                         │ • Генерация видео в HeyGen                   │
│                         │                  │                         │ • Уменьшение размера видео                   │
│                         │                  │                         │ • Наложение субтитров на видео               │
├─────────────────────────┼──────────────────┼─────────────────────────┼──────────────────────────────────────────────┤
│ Генерация видео         │ Ролики           │ Проверка фона и обложки │ • Генерация видео в HeyGen                   │
│                         │                  │                         │ • Уменьшение размера видео                   │
│                         │                  │                         │ • Финальное видео с субтитрами               │
├─────────────────────────┼──────────────────┼─────────────────────────┼──────────────────────────────────────────────┤
│ Подготовка к публикации │ Ролики           │ Выбор Соцсетей          │ • Добавление задачи на публикацию            │
│                         │                  │                         │ • Добавление задней обложки                  │
│                         │                  │                         │ • Генерация текста описания                  │
│                         │                  │                         │ • Публикация в соцсетях                      │
├─────────────────────────┼──────────────────┼─────────────────────────┼──────────────────────────────────────────────┤
│ Опубликовать            │ Публикации       │ Проверка текстов        │ • Публикация в соцсетях                      │
└─────────────────────────┴──────────────────┴─────────────────────────┴──────────────────────────────────────────────┘
```

### Changes

**1. Database: `automation_settings` table** (migration)
```sql
create table public.automation_settings (
  id uuid primary key default gen_random_uuid(),
  button_key text not null,        -- e.g. 'take_in_work', 'generate_video', 'prepare_publish', 'publish'
  process_key text not null,       -- e.g. 'voiceover', 'atmosphere', 'overlay', 'heygen', 'resize', 'subtitles'
  is_enabled boolean not null default true,
  created_at timestamptz default now(),
  unique(button_key, process_key)
);
```
Seed with all button/process combinations, all enabled by default. No RLS needed (authenticated read/write).

**2. `src/hooks/useAutomationSettings.ts`** (new)
- Fetches all rows from `automation_settings`
- Provides `isEnabled(buttonKey, processKey): boolean`
- Provides `toggle(buttonKey, processKey, enabled)` to update DB
- Caches in React Query

**3. `src/components/settings/ButtonActionsSettings.tsx`** (new)
- Renders the table matching the screenshot: columns for Button, Section, Pre-check, Processes (checkboxes)
- Each checkbox toggles via `useAutomationSettings().toggle()`
- Collapsible section in SettingsPage with anchor link "Управление действиями кнопок"

**4. `src/components/settings/SettingsPage.tsx`**
- Add collapsible sections with anchor links at the top: "Управление действиями кнопок" and "Подключения API"
- Embed `ButtonActionsSettings` component
- Wrap existing API cards in the second section

**5. `src/pages/Index.tsx`** — use the hook
- In `triggerAutoGeneration`: check `isEnabled('take_in_work', 'voiceover')`, `isEnabled('take_in_work', 'atmosphere')`, etc. before running each step
- In `handleGenerateVideo`: check `isEnabled('generate_video', 'heygen')` etc.
- In `handlePublishVideo`: check `isEnabled('prepare_publish', 'create_publication')`, `isEnabled('prepare_publish', 'concat')`, `isEnabled('prepare_publish', 'generate_text')`

**6. `src/components/publishing/PublicationsTable.tsx`**
- In `handlePublish`: check `isEnabled('publish', 'publish_social')`

This gives full control over which automated sub-processes fire when each button is clicked, matching the UI from the screenshots exactly.

