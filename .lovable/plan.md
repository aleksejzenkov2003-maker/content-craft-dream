

## Plan: Proxy Servers Screen

### Overview
Create a dedicated "Прокси-сервера" section with a new database table, hook, and UI component. Proxy servers will be standalone entities linked to publishing channels, enabling reuse across multiple channels.

### Database Changes

**New table `proxy_servers`:**
- `id` (uuid, PK)
- `name` (text, e.g. "Вашингтон (США)")
- `login` (text)
- `password` (text)
- `server` (text, e.g. "proxy.soax.com")
- `port` (integer)
- `protocol` (text, default "HTTP")
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamps)
- RLS: allow all for authenticated

**Alter `publishing_channels`:**
- Add `proxy_id` (uuid, nullable, FK to proxy_servers)
- Existing `proxy_server` and `location` fields remain for backward compatibility but `proxy_id` becomes the primary reference

### New Files

1. **`src/hooks/useProxyServers.ts`** — CRUD hook (fetch, add, update, delete) for `proxy_servers` table

2. **`src/components/proxies/ProxyServersGrid.tsx`** — Main screen:
   - Grid of cards, each card = one proxy server
   - Card shows: proxy name (location), badges for linked channels (color-coded by network type: red=YouTube, green=Instagram, blue=Facebook)
   - Click card → edit dialog with fields: Name, Login, Password, Server, Port, Protocol
   - "+ Новый Прокси" button
   - Channels are fetched from `publishing_channels` where `proxy_id` matches

### Modified Files

3. **`src/components/layout/Sidebar.tsx`** — Add "Прокси-сервера" nav item (icon: `Server` from lucide)

4. **`src/pages/Index.tsx`**:
   - Add header title for `proxies` tab
   - Render `<ProxyServersGrid />` when `activeTab === 'proxies'`

5. **`src/components/publishing/PublishingChannelsGrid.tsx`** — Replace proxy text input with a Select dropdown of proxy servers from the new table. When a proxy is selected, set `proxy_id` on the channel.

6. **`src/hooks/usePublishingChannels.ts`** — Update `PublishingChannel` interface to include `proxy_id`

### UI Layout (from mockup)

```text
┌──────────────────────────────────────────────┐
│  ПРОКСИ-СЕРВЕРА                  [+ Новый]   │
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐            │
│  │ Вашингтон   │  │ Нью-Йорк    │            │
│  │ [Yt1][Ig1]  │  │ [Yt4][Ig4]  │            │
│  │ [Fb1][Fb1]  │  │ [Fb4][Fb5]  │            │
│  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ Лондон      │  │ Нью-Касл    │            │
│  │ [Yt2][Ig2]  │  │ [Yt5][Ig5]  │            │
│  └─────────────┘  └─────────────┘            │
└──────────────────────────────────────────────┘
```

Edit dialog shows: Name, Login (with copy), Password (with copy), Server (with copy), Port (with copy), Protocol (display only).

