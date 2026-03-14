

## HeyGen Mode: Avatar III vs Avatar IV

### Суть
Оба режима работают одинаково — берут фото, загружают как `talking_photo`, генерируют видео. Разница только в **эндпоинте и качестве**:

- **Avatar III** (текущий): `POST v2/video/generate` — дешевле
- **Avatar IV** (старый дорогой, ~$6): `POST v2/video/av4/generate` — лучше мимика и движения головы

Весь остальной pipeline (voiceover, photo upload, status check, concat, subtitles) **не меняется**.

### Изменения

**1. Migration: таблица `app_settings`**

Key-value таблица для системных настроек. Первая запись — `heygen_mode` со значением `v3`.

```sql
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
INSERT INTO app_settings (key, value) VALUES ('heygen_mode', 'v3');
```

**2. Новый файл: `src/components/settings/VideoFormatSettings.tsx`**

- Загружает `heygen_mode` из `app_settings`
- Radio group:
  - **Avatar III** — Talking Photo, дешевле, стандартное качество
  - **Avatar IV** — Talking Photo, дороже (~$6), улучшенная мимика
- Upsert при смене

**3. Правка: `src/components/settings/SettingsPage.tsx`**

Заменить заглушку `video_format` на `<VideoFormatSettings />`

**4. Правка: `supabase/functions/generate-video-heygen/index.ts`**

Единственное изменение — перед вызовом HeyGen прочитать `heygen_mode` из `app_settings` и выбрать endpoint:

```typescript
const { data: settings } = await supabase
  .from('app_settings').select('value').eq('key', 'heygen_mode').single();
const mode = settings?.value || 'v3';

const endpoint = mode === 'v4'
  ? 'https://api.heygen.com/v2/video/av4/generate'
  : 'https://api.heygen.com/v2/video/generate';
```

Всё остальное (photo upload, voiceover, request body, response parsing) — без изменений. Оба эндпоинта принимают одинаковый `talking_photo` body и возвращают `video_id`.

**Не меняется:** `check-video-status`, concat, субтитры, публикация.

### Файлы
1. Migration — `app_settings` table
2. New — `src/components/settings/VideoFormatSettings.tsx`
3. Edit — `src/components/settings/SettingsPage.tsx`
4. Edit — `supabase/functions/generate-video-heygen/index.ts` (1 строка: выбор endpoint)

