
# План: Настройка рабочего функционала с API ключами

## Текущее состояние

Секреты `HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY` уже существуют в проекте. Нужно:
1. Обновить значения существующих ключей
2. Добавить новый секрет `KIE_API_KEY` для генерации обложек через kie.ai (Nano Banana)
3. Обновить edge-функцию `generate-cover` для использования kie.ai API вместо Lovable AI

## Шаг 1: Обновить/добавить секреты

| Секрет | Действие | Назначение |
|--------|----------|------------|
| `HEYGEN_API_KEY` | Обновить | Генерация видео |
| `ELEVENLABS_API_KEY` | Обновить | Озвучка (TTS) |
| `ANTHROPIC_API_KEY` | Обновить | Написание текстов (Claude) |
| `KIE_API_KEY` | Создать новый | Генерация обложек через Nano Banana |

## Шаг 2: Обновить `generate-cover/index.ts`

Заменить вызов Lovable AI на kie.ai Nano Banana API:

```text
Текущий flow: prompt -> Lovable AI (gemini-2.5-flash-image) -> base64 image
Новый flow:   prompt -> kie.ai createTask -> poll queryTask -> download image URL
```

API kie.ai работает асинхронно:
1. POST `https://api.kie.ai/api/v1/jobs/createTask` с моделью `nano-banana` и промтом
2. Получаем `taskId`
3. Поллинг GET `https://api.kie.ai/api/v1/jobs/queryTask?taskId=...` пока статус не станет `completed`
4. Получаем URL сгенерированного изображения
5. Скачиваем и загружаем в Supabase Storage

## Шаг 3: Обновить `generate-image/index.ts`

Аналогично обновить для использования kie.ai вместо Lovable AI (это общая функция генерации изображений).

## Шаг 4: Проверить остальные функции

| Функция | API | Статус |
|---------|-----|--------|
| `generate-voiceover` | ElevenLabs | Уже работает, ключ обновим |
| `generate-video-heygen` | HeyGen | Уже работает, ключ обновим |
| `create-heygen-video` | HeyGen | Уже работает, ключ обновим |
| `generate-post-text` | Anthropic Claude | Уже работает, ключ обновим |
| `generate-cover` | kie.ai (Nano Banana) | Нужно обновить |
| `generate-image` | kie.ai (Nano Banana) | Нужно обновить |
| `generate-scene` | Lovable AI | Оставляем как есть (или тоже на kie.ai?) |

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `supabase/functions/generate-cover/index.ts` | Переписать на kie.ai Nano Banana API |
| `supabase/functions/generate-image/index.ts` | Переписать на kie.ai Nano Banana API |
