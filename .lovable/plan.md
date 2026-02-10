

# Fix Settings Page API Tests

## Problems Found

1. **Anthropic "Проверить" always fails** -- the Settings page sends `{ prompt, maxTokens }` but the `test-prompt` edge function expects `{ systemPrompt, userTemplate, testContent }`. The function crashes trying to replace variables on `undefined`.

2. **HeyGen "Проверить" gives false positive** -- the `get-heygen-avatars` function returns `{ success: true }` from database cache even if the API key is invalid. The test never actually reaches the HeyGen API.

3. **Kie.ai "Проверить" fires a real generation** -- currently sends a full image generation request, wasting API credits and taking 30+ seconds. Needs a lightweight connectivity check instead.

4. **HeyGen spinner shows "C"** -- when testing HeyGen, the loading spinner character "C" is visible because the button shows `testingApi === api.key` while `api.key === 'heygen'` conflicts with display logic.

---

## Plan

### Fix 1: Anthropic test -- correct parameters
Update the `testApi('anthropic')` case in `SettingsPage.tsx` to send the correct fields:
```typescript
body: { 
  systemPrompt: 'You are a test assistant.', 
  userTemplate: '{{content}}', 
  testContent: 'Say "API connected" in 3 words',
  maxTokens: 20 
}
```

### Fix 2: HeyGen test -- force actual API call
Pass `{ forceRefresh: true }` to `get-heygen-avatars` so it skips cache and hits the real API:
```typescript
const { data, error } = await supabase.functions.invoke('get-heygen-avatars', {
  body: { forceRefresh: true }
});
```
Also check for `data?.apiError` field which indicates the API failed but cache was returned.

### Fix 3: Kie.ai test -- lightweight check
Create a new edge function `test-kie-api` that only calls `createTask` and immediately returns without polling. This verifies the API key works without generating an image. Alternatively, use a simple balance/account check if available, or just validate the `createTask` response returns a `taskId` then return success.

### Fix 4: Button loading state
Ensure the loading spinner is properly displayed for all APIs by checking the `testingApi` state correctly. The "C" visible in the screenshot is the first letter of the Cyrillic "Проверить" button text bleeding through during the spinner transition -- fix by ensuring the button content is exclusively the spinner when loading.

---

## Files to modify

| File | Change |
|------|--------|
| `src/components/settings/SettingsPage.tsx` | Fix Anthropic params, HeyGen forceRefresh, Kie.ai lightweight test, button display |
| `supabase/functions/test-kie-api/index.ts` | New edge function -- creates task and cancels immediately, just to verify API key |

## Technical Details

### New `test-kie-api` edge function:
- Calls `createTask` with a minimal prompt
- If `taskId` is returned, the API key is valid -- return success immediately
- Does NOT poll for completion (no image generated, no credits wasted)
- If 401/403, API key is invalid

### Settings page button fix:
The `disabled` prop prevents double-click, but the content needs a strict conditional:
```tsx
{testingApi === api.key ? (
  <Loader2 className="w-4 h-4 animate-spin" />
) : (
  'Проверить'
)}
```
This is already correct in code, so the "C" is likely from a render timing issue. Adding `className="min-w-[90px]"` to the button will prevent layout shift.
