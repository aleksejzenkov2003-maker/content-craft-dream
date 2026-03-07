

## Plan: Fix Badge ref warning + subtitle UI polish

### 1. Fix Badge forwardRef warning
**File:** `src/components/ui/badge.tsx`

The `Badge` component is a plain function component but receives a ref (from Radix UI's Presence/TabsContent hierarchy). Fix by wrapping with `React.forwardRef`.

### 2. Polish subtitle UI in VideoSidePanel  
**File:** `src/components/videos/VideoSidePanel.tsx`

- Show phase label more prominently (currently just text + %)
- Make cancel button (✕) more visible with an icon instead of text character
- Add a "Загрузка FFmpeg" phase description below the progress bar so user understands what's happening
- Ensure progress bar is visible during all phases (currently only shows when `subtitleProgress !== null`, which is correct, but add phase text below it)

### Technical details

**Badge fix** — change from:
```tsx
function Badge({ className, variant, ...props }: BadgeProps) {
```
to use `React.forwardRef` pattern, keeping the same `<div>` element.

**Subtitle UI** — minor text/layout improvements:
- Replace `✕` character with `X` lucide icon for consistency
- Add small muted text below progress bar showing current phase description
- Keep existing logic unchanged

