

## Проблема

При тестировании промптов типа `scene` реальная генерация (`generate-scene`) работает с фото духовника — композитит его в сцену через image editing API. Но в тесте промпта (`test-prompt`) фото духовника не передается — генерируется просто картинка по тексту, без учета фото.

## Решение

Добавить в форму тестирования для типов `scene` и `atmosphere` возможность выбрать духовника (и его фото), чтобы при тесте передавать фото в edge function для композитинга.

### 1. PromptForm.tsx — добавить выбор духовника для image-типов

- Принимать новый проп `advisors` (список духовников с фото)
- Для типов `atmosphere` / `scene` показать в панели тестирования выпадающий список духовников
- При выборе духовника — автоматически подставить URL его primary-фото
- Передавать `advisorPhotoUrl` в `onTest`

### 2. test-prompt edge function — поддержка image editing

- Принимать новый параметр `advisorPhotoUrl`
- Для image-типов, если передан `advisorPhotoUrl`:
  - Использовать multimodal API (text + image_url) для композитинга духовника в сцену (как делает `generate-scene`)
- Если `advisorPhotoUrl` не передан — генерировать просто фон как сейчас

### 3. usePrompts.ts — передавать advisorPhotoUrl

- Расширить `testPrompt` для передачи `advisorPhotoUrl` в body запроса

### 4. SettingsPage.tsx — передать advisors в PromptForm

- Загрузить список духовников через `useAdvisors` (уже есть хук)
- Передать `advisors` в `PromptForm`

### Файлы для изменения
- `src/components/prompts/PromptForm.tsx` — UI выбора духовника, передача фото
- `supabase/functions/test-prompt/index.ts` — обработка `advisorPhotoUrl`, image editing
- `src/hooks/usePrompts.ts` — расширить сигнатуру testPrompt
- `src/components/settings/SettingsPage.tsx` — передать advisors в форму

