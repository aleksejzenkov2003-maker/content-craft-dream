

## Problem

The "Burn subtitles" button fails every time with "FFmpeg долго загружается" because the 45-second timeout in `videoSubtitles.ts` is too short for downloading the ~30MB WASM binary from CDN. Network logs confirm the CDN responds with 200 -- the download just takes longer than 45 seconds.

## Root Cause

`withTimeout(loadFFmpegCore(ffmpeg!), 45000, ...)` -- the `toBlobURL()` call downloads the entire WASM file (~30MB), converts it to a blob URL, then `instance.load()` compiles it. On anything but a fast connection this exceeds 45 seconds.

## Plan

### 1. Remove the aggressive timeout on FFmpeg loading

Replace the 45-second hard timeout with a much more generous 180-second timeout (3 minutes). The WASM file is large and needs time to download and compile.

### 2. Add download progress feedback

Instead of showing a static "3%" while waiting, show intermediate progress during the download phase using `fetch` with `ReadableStream` progress tracking for the WASM file, so the user sees actual download progress (0-15%).

### 3. Unify FFmpeg instance with `videoNormalizer.ts`

Both `videoSubtitles.ts` and `videoNormalizer.ts` create separate FFmpeg singletons with different CDN configs (UMD vs ESM). Consolidate into a single shared module (`src/lib/ffmpegLoader.ts`) that:
- Uses UMD build (more compatible)
- Has a single cached instance
- Reports download progress
- Uses a 180-second timeout

### Technical Details

**New file: `src/lib/ffmpegLoader.ts`**
- Exports `getSharedFFmpeg(onProgress?)` 
- Downloads WASM with fetch + ReadableStream to track bytes received
- Maps download progress to 0-15% range
- Falls back between unpkg and jsdelivr CDNs
- 180-second timeout

**Updated: `src/lib/videoSubtitles.ts`**
- Remove local FFmpeg loading logic
- Import `getSharedFFmpeg` from ffmpegLoader
- Keep burn logic unchanged

**Updated: `src/lib/videoNormalizer.ts`**  
- Remove local FFmpeg loading logic
- Import `getSharedFFmpeg` from ffmpegLoader

