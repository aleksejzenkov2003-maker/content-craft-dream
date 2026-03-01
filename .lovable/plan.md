

## Вынос промтов в настройки с точечным редактированием перед генерацией

### Текущая ситуация
Сейчас промты захардкожены в 3 местах:
1. **Атмосфера обложки** (`generate-cover`) — system/user prompt для генерации атмосферного промта через AI, плюс дефолтный fallback
2. **Сцены** (`generate-scene`) — захардкоженный промт для генерации фоновой сцены
3. **Текст публикации** (`generate-post-text`) — дефолтный промт, если у канала нет `post_text_prompt`

### План

#### 1. Добавить новые типы промтов в систему
Расширить список типов в `PromptForm.tsx` и переменных:
- `atmosphere` — Промт атмосферы обложки (переменные: `{{question}}`, `{{hook}}`, `{{answer}}`, `{{advisor}}`, `{{playlist}}`)
- `scene` — Промт сцены (переменные: `{{playlist}}`, `{{advisor}}`)
- `post_text` — Промт текста публикации (переменные: `{{question}}`, `{{hook}}`, `{{answer}}`, `{{advisor}}`)

#### 2. Создать дефолтные промты через seed
Вставить 3 дефолтных промта в таблицу `prompts` через insert-запрос, содержащих текущие захардкоженные тексты.

#### 3. Обновить Edge Functions — читать промты из БД
- **`generate-cover`**: Вместо захардкоженного system/user prompt для AI — читать активный промт типа `atmosphere` из `prompts`, подставлять переменные
- **`generate-scene`**: Читать активный промт типа `scene`, подставлять переменные
- **`generate-post-text`**: Читать активный промт типа `post_text` как fallback (вместо захардкоженного)

#### 4. UI: Точечное редактирование промта перед генерацией

**VideoSidePanel** (обложки):
- Добавить сворачиваемую секцию с textarea для промта атмосферы перед кнопкой "Шаг 1: Фон"
- Промт предзаполняется из активного промта типа `atmosphere` с подставленными переменными видео
- Пользователь может отредактировать перед нажатием "Сгенерировать"
- Передавать отредактированный промт в `generate-cover`

**SceneSidePanel** (сцены):
- Textarea уже есть (`scene_prompt`), но нужно предзаполнять из активного промта типа `scene` если поле пустое

**PublicationEditDialog** (тексты публикаций):
- Нет необходимости — у каналов уже есть поле `post_text_prompt`, просто нужно fallback на промт из настроек

#### 5. Файлы для изменения
- `src/components/prompts/PromptForm.tsx` — добавить типы и переменные
- `supabase/functions/generate-cover/index.ts` — читать промт из БД
- `supabase/functions/generate-scene/index.ts` — читать промт из БД
- `supabase/functions/generate-post-text/index.ts` — читать fallback промт из БД
- `src/components/videos/VideoSidePanel.tsx` — textarea для промта атмосферы
- `src/components/scenes/SceneSidePanel.tsx` — предзаполнение из промта
- `src/pages/Index.tsx` — передача промта в handleGenerateAtmosphere

