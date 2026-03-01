

## Cover Composition: Replace AI Generation with Programmatic Image Compositing

### Current Problem
Step 2 of cover generation uses `nano-banana-pro` (another AI image generation call) to overlay the advisor photo + hook text onto the atmosphere background. This is slow, expensive, unpredictable, and doesn't match the n8n workflow approach.

### Key Insight from User
- **Video** is generated from **Scene photo** (playlist_scenes table — scene per playlist+advisor)
- **Cover** = atmosphere background + hook text + advisor miniature — composed programmatically (canvas compositing), NOT via AI generation

### Plan

#### 1. Rewrite Step 2 in `generate-cover` Edge Function
Replace the `nano-banana-pro` AI call with programmatic image compositing using Deno Canvas API (`jsr:@gfx/canvas` or similar):

- Download the atmosphere image (already generated in Step 1)
- Download the advisor's primary photo from `advisor_photos`
- Draw atmosphere as full background (1080x1920, 9:16)
- Draw advisor photo as a circular miniature in bottom-left area (~30% width)
- Render hook text (`video.hook` or `video.hook_rus`) as styled text overlay
- Export as PNG, upload to storage

This is deterministic, instant, and matches the n8n compositing approach.

#### 2. Technical Implementation Details

```text
┌─────────────────────┐
│                     │
│   ATMOSPHERE BG     │
│   (full 1080x1920)  │
│                     │
│                     │
│  ┌─────────────┐    │
│  │  HOOK TEXT   │    │
│  │  (centered)  │    │
│  └─────────────┘    │
│                     │
│  ┌───┐              │
│  │ 📷│ Advisor Name │
│  └───┘              │
└─────────────────────┘
```

- Use `jsr:@nicolo-ribaudo/canvas` or `npm:canvas` (Deno-compatible) for server-side image compositing
- Circular clip for advisor photo
- White/light text with shadow for hook readability
- Advisor display name near the miniature

#### 3. Files to Modify
- **`supabase/functions/generate-cover/index.ts`** — Replace Step 2 (lines 263-339) with canvas compositing logic instead of Kie.ai API call. Keep Step 1 (atmosphere generation) unchanged.

No database or UI changes needed — the output (front_cover_url) stays the same, just produced differently.

