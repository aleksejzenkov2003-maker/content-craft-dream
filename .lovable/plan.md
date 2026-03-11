

## Переход с Avatar IV (av4) на Avatar III (v2/video/generate)

### Суть изменения

Сейчас `generate-video-heygen` использует эндпоинт `v2/video/av4/generate` — это Avatar IV (1 кредит / 10 сек, ~6 кредитов/мин). Нужно переключить на `v2/video/generate` — Avatar III (1 кредит / минута, в 6 раз дешевле).

### Разница в API

```text
Avatar IV (av4):                         Avatar III (v2):
POST /v2/video/av4/generate              POST /v2/video/generate
{                                        {
  image_key: "...",                        video_inputs: [{
  audio_asset_id: "...",                     character: {
  video_orientation: "portrait",               type: "talking_photo",
  fit: "cover",                                talking_photo_id: "<image_key>"
  custom_motion_prompt: "..."                },
}                                            voice: {
                                               type: "audio",
                                               audio_url: "<voiceover_url>"
                                             }
                                           }],
                                           dimension: { width: 1080, height: 1920 }
                                         }
```

Avatar III использует `talking_photo` с `talking_photo_id` (тот же image_key от upload) и принимает `audio_url` напрямую — **не нужно отдельно загружать аудио как asset**.

### Что меняется

**1. `supabase/functions/generate-video-heygen/index.ts`**
- Оба вызова av4 (scene-based и fallback) заменяются на один формат `v2/video/generate`
- Убираем `uploadAudioToHeygen` — v2 принимает `audio_url` напрямую
- Используем `character.type = "talking_photo"` + `talking_photo_id = imageKey`
- Убираем `custom_motion_prompt` (не поддерживается в v3)
- Добавляем `dimension` вместо `video_orientation`

**2. `supabase/functions/create-heygen-video/index.ts`** — уже использует v2 API, трогать не нужно.

### Что сохраняется
- Логика выбора фото (scene → advisor photo → cover fallback)
- Загрузка фото через `uploadAssetToHeygen` (image_key нужен и для v3)
- Генерация voiceover через ElevenLabs
- Polling статуса через `check-video-status`
- Все остальные функции без изменений

