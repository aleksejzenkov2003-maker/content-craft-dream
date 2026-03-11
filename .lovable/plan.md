

## Plan: Show Channel Binding Only for "Текст публикации" + Audit Prompt Flow

### Analysis of Current Prompt Flow

The prompt system works across 3 scenarios:

1. **Фон обложки (atmosphere)** — `generate-cover` edge function fetches active `atmosphere` prompt from DB (`is_active=true`), uses `system_prompt` + `user_template` with variables `{{question}}`, `{{hook}}`, `{{answer}}`, `{{advisor}}`, `{{playlist}}`. No channel binding needed — works correctly.

2. **Сцена монологов (scene)** — `generate-scene` edge function + `SceneSidePanel` fetches active `scene` prompt (`is_active=true`), uses `user_template` with `{{playlist}}`, `{{advisor}}`. No channel binding needed — works correctly.

3. **Текст публикации (post_text)** — `generate-post-text` edge function resolves prompt via: channel's `prompt_id` → channel's `post_text_prompt` → active DB prompt → hardcoded fallback. Channel binding IS needed here and is the only type that uses it.

### Problem

The "Привязка к каналам" checkbox panel currently shows for ALL prompt types in `PromptsPage.tsx`. It should only appear when type = `post_text`, since atmosphere and scene prompts use `is_active` flag (not channel binding).

### Changes

**1. `src/components/prompts/PromptsPage.tsx`** (lines 313-340)
- Wrap the "Привязка к каналам" block in a conditional: only render when `form.type === 'post_text'`
- When type is not `post_text`, show the Name field full-width instead of half-width

**2. No edge function changes needed** — all three prompt flows already work correctly:
- `atmosphere` + `scene`: use `is_active=true` lookup
- `post_text`: uses `prompt_id` on `publishing_channels` table

This is a single UI change — hide the channel binding panel for non-post-text prompt types.

