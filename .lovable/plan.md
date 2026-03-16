

## Problem

The karaoke highlight approach is fundamentally flawed: it draws white base text + separate yellow word overlays on top, but Browser Canvas `measureText` doesn't match FFmpeg's `drawtext` font metrics. This causes visible misalignment — yellow words shift left/right relative to the white base, creating the messy overlap seen in the screenshots.

## Solution: Single-layer approach

Instead of overlaying yellow words on white text, render **each word individually as its own drawtext filter** — white when not spoken, yellow when spoken. No overlay, no alignment issues.

For each block, each word gets **two** drawtext entries:
1. **White** (default): `enable='between(t, blockStart, blockEnd)' AND NOT between(t, wordStart, wordEnd)`
2. **Yellow** (active): `enable='between(t, wordStart, wordEnd)'`

But this doubles the filter count. A simpler and more robust approach:

**Draw each word separately with its own `text_w` calculation** using FFmpeg's native positioning. Each word uses `x=(w-TEXT_W)/2+WORD_OFFSET` where both `TEXT_W` and `WORD_OFFSET` are computed by FFmpeg itself (not browser Canvas).

The cleanest FFmpeg-native approach: render the **full block text in white** for the entire block duration, then for each word's spoken time, render the **full block text again in yellow but clipped** to just that word's region. However, drawtext doesn't support clipping.

**Best approach**: Use a single drawtext per block that changes color per-word via FFmpeg's `if()` expression in `fontcolor`. Unfortunately, drawtext doesn't support per-character color switching.

**Practical best approach**: Keep the overlay method but **let FFmpeg compute positions natively** instead of using browser Canvas. For each word overlay, calculate the x-offset using the **same font file and size** by pre-rendering a prefix measurement drawtext. This is too complex.

**Simplest reliable fix**: Show only **one word at a time** (not the full block). Each word appears alone, centered, yellow, for its spoken duration. This eliminates all alignment issues entirely and creates a clean karaoke effect.

## Implementation

### `src/lib/videoSubtitles.ts`

Rewrite `buildHighlightDrawtextFilter`:
- Instead of base white layer + yellow word overlays, show **one word at a time centered on screen**
- Each word gets a single drawtext: yellow, centered `x=(w-text_w)/2`, enabled only during `between(t, word.start, word.end)`
- This is clean, precise, and impossible to misalign
- Massively reduces filter count (1 filter per word vs 2+ per word)
- Remove `measureWordOffsets` function (no longer needed)

```typescript
function buildHighlightDrawtextFilter(
  blocks: TimedBlock[],
  fontSize = 44,
): string {
  if (blocks.length === 0) return 'null';
  const filters: string[] = [];

  for (const b of blocks) {
    if (!b.words || b.words.length === 0) {
      // Fallback: show full block text
      const escaped = escapeDrawtext(b.text);
      filters.push(
        `drawtext=fontfile=${FONT_PATH}:text='${escaped}':fontsize=${fontSize}:fontcolor=0xFFCC00:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h*0.55):enable='between(t,${b.startSec.toFixed(3)},${b.endSec.toFixed(3)})'`
      );
      continue;
    }

    for (const w of b.words) {
      const escaped = escapeDrawtext(w.word);
      filters.push(
        `drawtext=fontfile=${FONT_PATH}:text='${escaped}':fontsize=${fontSize}:fontcolor=0xFFCC00:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h*0.55):enable='between(t,${w.start.toFixed(3)},${w.end.toFixed(3)})'`
      );
    }
  }

  return filters.join(',');
}
```

### Changes summary
- **Remove**: `measureWordOffsets` function (~30 lines)
- **Rewrite**: `buildHighlightDrawtextFilter` — one word at a time, centered, no overlay alignment needed
- No other files affected

