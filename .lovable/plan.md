

## Problem

FFmpeg exits with code 1 on `drawtext` filter because **ffmpeg.wasm has no fonts available** in its virtual filesystem. The `drawtext` filter requires an explicit `fontfile=` parameter pointing to a `.ttf` file — without it, FFmpeg cannot render any text and fails silently. This is why concat works (no fonts needed) but subtitles fail.

We also have zero visibility into the actual FFmpeg error because we never listen to the `log` event.

## Solution

1. **Provide a font file** — fetch Montserrat Bold (already used in ASS style) from Google Fonts CDN, write it into FFmpeg's virtual filesystem, and reference it in every `drawtext` instance.

2. **Add FFmpeg log capture** — listen to the `log` event during exec to capture the actual error message. This prevents future blind debugging.

3. **Use `-filter_complex_script`** — with 40 subtitle blocks, the filter string is 6000+ chars. Writing it to a file in the virtual FS avoids potential argument length and escaping issues.

## Changes

**File: `src/lib/videoSubtitles.ts`**

1. Add a font loading utility at the top:
```typescript
let fontData: Uint8Array | null = null;
const FONT_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-700-normal.ttf';
const FONT_PATH = '/tmp/Montserrat-Bold.ttf';

async function ensureFont(ff: FFmpeg): Promise<void> {
  if (!fontData) {
    const resp = await fetch(FONT_URL);
    fontData = new Uint8Array(await resp.arrayBuffer());
  }
  await ff.writeFile(FONT_PATH, fontData);
}
```

2. Update `buildDrawtextFilter` to include `fontfile=/tmp/Montserrat-Bold.ttf` in every drawtext entry.

3. In both `burnSubtitlesHybrid` and `burnSubtitlesBrowser`, before running `ff.exec`:
   - Call `await ensureFont(ff)`
   - Write the filter string to a file: `await ff.writeFile('filter.txt', vf)`
   - Use `-filter_complex_script filter.txt` instead of `-vf`

4. Add a log listener around `ff.exec` to capture FFmpeg stderr:
```typescript
const logs: string[] = [];
const logHandler = ({ message }: { message: string }) => logs.push(message);
ff.on('log', logHandler);
// ... exec ...
if (exitCode !== 0) {
  console.error('[ffmpeg logs]', logs.join('\n'));
  throw new Error(`FFmpeg error: ${logs.slice(-3).join(' | ')}`);
}
```

5. Clean up the font and filter files in the `finally` block.

No other files need changes.

