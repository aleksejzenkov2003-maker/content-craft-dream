

## Plan: Remove Voices/Instructions, Add API Balance Display

### What to remove
- ElevenLabs voices card (lines 174-227)
- "Как настроить голос духовника" instructions card (lines 229-241)
- Related state: `voices`, `loadingVoices`, `playingVoice`, `Voice` interface, `fetchVoices`, `playVoicePreview`

### What to add
A new "Баланс API" card showing current balance/usage for each service. Will create an edge function `check-api-balances` that calls:

- **ElevenLabs**: `GET https://api.elevenlabs.io/v1/user/subscription` → `character_count` / `character_limit`
- **HeyGen**: `GET https://api.heygen.com/v2/user/remaining_quota` → `remaining_quota` (÷60 = credits)
- **Anthropic**: No public balance endpoint — skip or show "N/A"
- **Kie.ai**: No standard balance endpoint — skip or show "N/A"

### Changes

1. **`supabase/functions/check-api-balances/index.ts`** (new)
   - Calls ElevenLabs subscription + HeyGen remaining_quota in parallel
   - Returns `{ elevenlabs: { used, limit, resetUnix }, heygen: { remainingCredits } }`

2. **`supabase/config.toml`** — add `[functions.check-api-balances]` with `verify_jwt = false`

3. **`src/components/settings/SettingsPage.tsx`**
   - Remove Voice interface, voices state, loadingVoices, playingVoice, fetchVoices, playVoicePreview
   - Remove voices card and instructions card
   - Add `balances` state and `fetchBalances()` calling the new edge function
   - Add "Баланс API" card showing:
     - ElevenLabs: progress bar `character_count / character_limit` + reset date
     - HeyGen: remaining credits number
     - Anthropic / Kie.ai: "Баланс недоступен через API"

