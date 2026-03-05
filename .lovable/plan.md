

## Plan: Dedicated Prompts Page

### Overview
Move prompt management from Settings to its own sidebar tab "Промты" with a card grid (matching mockup) and an edit dialog with channel linking.

### Database Changes

**Alter `publishing_channels`:**
- Add `prompt_id` (uuid, nullable, FK to `prompts`) — replaces text-based `post_text_prompt` as primary prompt reference

### Sidebar & Routing

- Add "Промты" nav item (icon: `FileText`) to `Sidebar.tsx` after "Прокси-сервера"
- Add `prompts` to `headerTitles` in `Index.tsx`
- Render new `<PromptsPage />` when `activeTab === 'prompts'`

### New: `src/components/prompts/PromptsPage.tsx`

**Card Grid** (matching mockup style):
- 2-column responsive grid of cards with dashed border
- Each card shows: prompt name, model badge (red, e.g. "Claude Sonnet 4.5"), type badge (green, e.g. "Текст" / "Изображение"), delete icon (top-right), edit icon (bottom-right)
- "+ Новый Промт" button top-right

**Edit Dialog** (two-column layout per mockup):
- Left column: Name, Model (select), Type (select), Temperature (input), Max Tokens (input), System Prompt (textarea), User Prompt (textarea with variable chips)
- Right column: Link dropdown (select from `publishing_channels` grouped by network type, e.g. "Каналы публикаций - Youtube"), Result area (for testing)
- Footer: Отмена / Сохранить buttons
- When saving with a Link selected, set `prompt_id` on that channel

### Modified Files

1. **`src/components/layout/Sidebar.tsx`** — Add "Промты" nav item
2. **`src/pages/Index.tsx`** — Add prompts tab, import & render `PromptsPage`, pass `usePrompts` + `useAdvisors` data
3. **`src/hooks/usePublishingChannels.ts`** — Add `prompt_id` to interface
4. **`src/components/publishing/PublishingChannelsGrid.tsx`** — Use `prompt_id` instead of text matching for prompt display
5. **`src/components/settings/SettingsPage.tsx`** — Remove prompts section (keep only API checks and voices)

### Channel Integration
- When editing a prompt, user can select which channel(s) it links to via the "Link" dropdown
- Saving updates `publishing_channels.prompt_id` for the selected channel
- In channels grid, show linked prompt name from `prompt_id` reference instead of text matching

