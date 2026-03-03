

## Problem

The `composeCover` function in `generate-cover/index.ts` uses CSS properties not supported by Satori:
- `textShadow` (lines 156, 197) — causes the crash
- `boxShadow` (line 185) — may also fail
- `objectFit: 'cover'` on `<img>` — not fully supported

## Fix

Replace unsupported CSS properties with Satori-compatible alternatives:

### File: `supabase/functions/generate-cover/index.ts`

1. **Remove all `textShadow`** (lines 156, 197) — replace with a semi-transparent dark overlay behind the text area to ensure readability against the background.

2. **Remove `boxShadow`** from advisor photo (line 185) — use a thicker white border instead.

3. **Replace `objectFit: 'cover'`** on background image — Satori supports `objectFit` on `img` in recent versions, but if it fails, fall back to using the image as a background via absolute positioning with `width: 100%` and `height: 100%`.

4. **Add a dark gradient overlay** element between the background image and the text content. This replaces the text shadow effect for readability:
   - A `div` with `position: absolute`, `background: linear-gradient(...)` from transparent to dark at top and bottom.

### Specific changes

**Hook text block** (line 150-159): Remove `textShadow`, keep other styles.

**Advisor name** (line 192-198): Remove `textShadow`.

**Advisor photo** (line 179-186): Remove `boxShadow`, increase border width to `6px solid white`.

**New overlay element**: Add between the background `<img>` and the content elements:
```jsx
React.createElement('div', {
  style: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.5) 100%)',
  }
})
```

### Files to change
- `supabase/functions/generate-cover/index.ts` — remove unsupported CSS, add gradient overlay

