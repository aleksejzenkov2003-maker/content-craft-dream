

## Plan: Proxy channel binding + read-only fields in channels

### What changes

1. **PublishingChannelsGrid** — remove editable proxy selector and prompt textarea from the channel edit dialog. Replace with read-only display badges showing the currently linked prompt and proxy (if any). These are managed from their respective pages.

2. **ProxyServersGrid** — add a "Привязка к каналам" (Channel binding) section in the proxy edit dialog, identical to how it works in PromptsPage. Checkbox list of all channels, saving updates `proxy_id` on each selected channel.

### Technical details

**PublishingChannelsGrid.tsx:**
- Remove the `<Select>` for proxy (`proxy_id`) and the `<Select>` + `<Textarea>` for prompt
- Remove `useProxyServers` import (no longer needed)
- Remove `proxy_id` and `post_text_prompt` from `formData`
- In the dialog, show read-only info: "Промт: {name}" and "Прокси: {name}" as badges/text, or "Не привязан"
- `handleSubmit` no longer sends `proxy_server`, `location`, `proxy_id`, `post_text_prompt` fields

**ProxyServersGrid.tsx:**
- Add state `linkedChannelIds: string[]` for tracking which channels are bound to the current proxy
- On `handleOpenDialog`: populate `linkedChannelIds` from `channels.filter(ch => ch.proxy_id === proxy.id)`
- On `handleSubmit`: after saving proxy, iterate channels to update `proxy_id` (link new, unlink removed) — same pattern as PromptsPage
- Add a "Привязка к каналам" section in the dialog with checkbox list grouped by network type
- When linking, also set `proxy_server` and `location` on the channel; when unlinking, clear them

