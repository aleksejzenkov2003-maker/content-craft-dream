
# Plan: Fix API Integrations and Add Settings Page

## Issues Found

### 1. kie.ai (Nano Banana) -- CRITICAL BUG in polling
Both `generate-cover` and `generate-image` edge functions have incorrect polling logic:
- **Wrong field**: checking `result.data?.status` but the API returns `result.data?.state`
- **Wrong values**: checking for `'completed'` / `'SUCCESS'` but the API returns `'success'`
- **Wrong result extraction**: looking for `result.data?.output?.imageUrl` but the API returns results in `result.data?.resultJson` as a JSON string with `resultUrls` array
- **Wrong model name**: using `'google/nano-banana'` -- needs to be `'nano-banana-pro'` per the docs
- **Missing aspect_ratio**: kie.ai supports `aspect_ratio` in input but we're not passing it

### 2. HeyGen -- Workflow issue
The `generate-video-heygen` function uses HeyGen's built-in TTS (`voice.type: 'text'`) instead of the intended flow:
- Current: sends text to HeyGen, HeyGen does both TTS and avatar animation
- Required: first generate voiceover via ElevenLabs, then send audio to HeyGen to animate the talking photo
- The function needs to either: (a) accept a pre-generated audio URL, or (b) call ElevenLabs first, then send audio to HeyGen

### 3. ElevenLabs -- Voice selection hardcoded
- Voice is hardcoded to "Григорий" (`B7vhQtHJ3xG23dClyJE4`) in `generate-voiceover`
- Should use the advisor's `elevenlabs_voice_id` from the database
- `get-elevenlabs-voices` function exists but isn't connected to any UI for voice selection

### 4. Anthropic -- Works correctly
- `generate-post-text` properly calls Claude API with channel prompts
- Auto-generation on publication creation is wired up in `usePublications.addPublication`

### 5. Settings page is empty
- Currently shows "Настройки будут добавлены позже"
- Needs API configuration display/testing and voice selection

---

## Implementation Plan

### Step 1: Fix kie.ai polling in both edge functions
Update `pollTaskStatus` in `generate-cover/index.ts` and `generate-image/index.ts`:
- Check `result.data?.state` instead of `result.data?.status`
- Match on `'success'` instead of `'completed'`/`'SUCCESS'`
- Parse `result.data?.resultJson` (JSON string) and extract `resultUrls[0]`
- Match failure on `'fail'` instead of `'FAILED'`/`'failed'`
- Change model from `'google/nano-banana'` to `'nano-banana-pro'`
- Pass `aspect_ratio` in the input object (e.g. `'9:16'` for covers)

### Step 2: Fix HeyGen video generation to use ElevenLabs audio
Update `generate-video-heygen/index.ts`:
- Accept optional `audioUrl` parameter
- If no `audioUrl`, first call ElevenLabs to generate voiceover from script using the advisor's `elevenlabs_voice_id`
- Then send audio to HeyGen using `voice.type: 'audio'` with `audio_url` instead of `voice.type: 'text'`
- This ensures the correct advisor voice is used via ElevenLabs

### Step 3: Fix voiceover to use advisor's voice
Update `generate-voiceover/index.ts`:
- Accept optional `voiceId` parameter
- If `voiceId` provided, use it; otherwise look up advisor's `elevenlabs_voice_id`; fallback to Grigory voice
- Accept optional `videoId` parameter to look up the advisor

### Step 4: Build Settings page
Create a settings page with sections:
- **API Status**: show connected status for each API (Anthropic, ElevenLabs, HeyGen, Kie.ai) based on whether secrets exist
- **Voice Settings**: dropdown to select default ElevenLabs voice, with option to test voices (uses `get-elevenlabs-voices`)
- **Advisor Voice Config**: link to advisors page for per-advisor voice settings (already exists in AdvisorsGrid settings dialog)

### Step 5: Add voice selection to Advisor settings dialog
The dialog in `AdvisorsGrid.tsx` already has a text field for ElevenLabs Voice ID. Enhance it with:
- A dropdown populated from `get-elevenlabs-voices` edge function
- Preview/play button for each voice

---

## Technical Details

### kie.ai polling fix (corrected code pattern):
```typescript
// Check state (not status)
if (result.data?.state === 'success') {
  const resultJson = JSON.parse(result.data.resultJson);
  const urls = resultJson.resultUrls;
  if (urls && urls.length > 0) return urls[0];
  throw new Error('No result URLs found');
}
if (result.data?.state === 'fail') {
  throw new Error('Task failed: ' + result.data.failMsg);
}
```

### HeyGen with audio (corrected API call):
```typescript
// Using audio URL instead of text
voice: {
  type: 'audio',
  audio_url: voiceoverUrl,  // Pre-generated ElevenLabs audio
}
```

### Files to modify:
- `supabase/functions/generate-cover/index.ts` -- fix polling + model name
- `supabase/functions/generate-image/index.ts` -- fix polling + model name
- `supabase/functions/generate-video-heygen/index.ts` -- add ElevenLabs voiceover step
- `supabase/functions/generate-voiceover/index.ts` -- use advisor voice ID
- `src/pages/Index.tsx` -- replace settings placeholder with settings component
- `src/components/settings/SettingsPage.tsx` -- new component
- `src/components/advisors/AdvisorsGrid.tsx` -- enhance voice selection in dialog
