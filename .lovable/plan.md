

## Problem

Two issues with prompt editing for image-related types (`atmosphere`, `scene`):

1. **Model selector** only shows Anthropic/Claude text models. For `atmosphere`/`scene` prompts, image generation models (like `google/gemini-2.5-flash-image`, `google/gemini-3-pro-image-preview`) should be available.
2. **Test function** (`test-prompt` edge function) always calls Anthropic text API. For image prompts, it should call the Lovable AI gateway to generate an image and return/display it.

## Plan

### 1. Update `PromptForm.tsx` — separate model lists by type

- Add `IMAGE_MODELS` list with image generation models (`google/gemini-2.5-flash-image`, `google/gemini-3-pro-image-preview`, `nano-banana-pro` via Kie.ai).
- Dynamically switch model dropdown based on `form.type`: show `IMAGE_MODELS` for `atmosphere`/`scene`, show text `MODELS` for others.
- Auto-switch `form.model` when type changes (so user doesn't end up with a Claude model on an image prompt).
- In test results: if type is `atmosphere`/`scene`, render result as `<img>` instead of text.

### 2. Update `test-prompt` edge function — support image generation

- Check if the prompt type is `atmosphere` or `scene` (pass `type` from frontend).
- For image types: use Lovable AI gateway (`ai.gateway.lovable.dev/v1/chat/completions`) with `modalities: ["image", "text"]` to generate an image. Return the base64 image URL.
- For text types: keep existing Anthropic logic.
- Also support the Kie.ai model path if `nano-banana-pro` is selected (use existing `generate-image` logic).

### 3. Update `SettingsPage.tsx` — pass `type` to test function

- Ensure `testPrompt` sends `type` along with the other prompt data to the edge function.

### Files to change
- `src/components/prompts/PromptForm.tsx` — model lists, auto-switch, image result display
- `supabase/functions/test-prompt/index.ts` — image generation branch
- `src/components/settings/SettingsPage.tsx` — minor update to pass type

