

## Plan: Fix karaoke subtitle alignment + Video carousel in side panel

### Problem 1: Karaoke highlight misalignment
The current approach renders each highlighted word as a **separate** `drawtext` filter with manually calculated x-position using `charWidth = fontSize * 0.55`. This approximation causes words to appear shifted — not aligned with the base white text underneath.

**Fix**: Instead of overlaying individual words at calculated positions, use the **full block text** for both layers but change only the highlighted word's color. For each word's time window, render the entire block text in white, then overlay the same full text but with only the target word in yellow. However, `drawtext` doesn't support per-word coloring.

**Better approach**: Keep the full-text white base layer. For each word highlight, instead of rendering the word standalone at a calculated offset, render the full text again but use a crop/mask approach. Actually, the simplest reliable fix: use `text_w` of the **full block** for centering, then compute word offset using the same `text_w` proportionally.

**Simplest fix that works**: Render each word overlay using the full block's centering. Calculate x as `(w - fullTextWidth)/2 + wordPixelOffset`. The issue is `fullTextWidth` must match `text_w` of the base layer. We can't use `text_w` variable cross-filter. 

**Practical fix**: Use a single drawtext per word-time with the **full block text**, but set `fontcolor_expr` or use alpha tricks. FFmpeg drawtext doesn't support `fontcolor_expr` per-character.

**Most reliable fix**: Abandon separate word overlays. Instead, for each word's time range, render **two** full-text layers:
1. Left part (before word) in white
2. The word itself in yellow  
3. Right part (after word) in white

But this still has alignment issues with multiple filters.

**Actually the cleanest approach**: Keep current architecture but fix the `charWidth` calculation. The problem is the fixed `0.55` multiplier. Instead, use `text_w` from a reference drawtext. But we can't share variables between drawtext filters.

**Real practical fix**: Instead of separate word overlays, for each word timing, render the **entire line** in yellow and use it as the only layer (no white base). During each word's time, show the full line but only the current word is yellow, rest is white. This means for a block with N words, we need N full-line drawtexts (one per word timing), each with the full text in white but the current word replaced visually. Since drawtext can't do per-char colors, we need a different strategy.

**Final approach - simplest and most reliable**: For each word's time window within a block, render the **complete line text in white** as base (already done), then overlay **just the word** but use the base text's positioning formula. The key fix: instead of hardcoded `charWidth`, measure the offset by rendering a prefix substring and using its `text_w`. We can do this with a hidden drawtext that has `fontcolor=0x00000000` (transparent) but that's overly complex.

**Actual simplest fix**: The real issue from the screenshot is the yellow word appears on top of the white text but at a wrong position. The fix is to use `text_w` expression **within** the drawtext filter itself for the prefix text. FFmpeg supports expressions like `text_w` only for the current filter's text. 

**Working approach**: For each word highlight, use expression-based x positioning. Render a drawtext with the prefix text (words before current word) with transparent color, and use its `text_w` to position. But FFmpeg doesn't support this cross-filter.

**Let me reconsider**: Looking at the screenshot again - "you ask: can it be whole" - the word "ask" has yellow highlight but it's overlapping incorrectly. The `charWidth = fontSize * 0.55` approximation is simply wrong for variable-width fonts.

**Best practical fix**: Switch from individual word overlays to a **per-word-timing full-line** approach. For each word's timing in a block, render the ENTIRE block text but with only that word colored yellow. Since drawtext can't do mixed colors, we render:
1. Full text in white (base, for entire block duration) - already exists
2. For each word: render the word at the correct x. But instead of `charWidth * offset`, use a **monospace-friendly font** or compute offset differently.

**Actually the simplest reliable fix**: Use `Courier` or another monospace font where `charWidth` is exact. But that changes the aesthetic.

**Or**: Pre-render the x-offset at generation time by measuring text width using canvas API (in browser). We have access to the font in the browser before generating the filter.

**Plan**: Use Canvas `measureText` to get exact pixel widths for prefix strings, then use those exact pixel values in the drawtext filter x-positions. This eliminates the `charWidth * 0.55` approximation entirely.

### Problem 2: Video carousel
Currently the Video column shows a single `<video>` element. Need to make it browsable like the cover/atmosphere carousels, showing multiple video versions:
- "HeyGen видео" (`heygen_video_url`)
- "С субтитрами" (`video_path`, if different from heygen_video_url)
- Could have multiple subtitle versions in future

### Changes

**`src/lib/videoSubtitles.ts`** — `buildHighlightDrawtextFilter`:
- Accept pre-computed word offsets (pixel values) instead of using `charWidth * 0.55`
- Before building the filter, use OffscreenCanvas/Canvas to `measureText` for each prefix substring using the actual Montserrat Bold font
- Pass exact x-offsets into the drawtext expressions

**`src/components/videos/VideoSidePanel.tsx`** — Video section:
- Build an array of video variants: `[{label, url}]` from `heygen_video_url` and `video_path`
- Add carousel navigation (ChevronLeft/Right + index counter) identical to covers
- Show label on each video variant

