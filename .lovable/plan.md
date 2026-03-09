

## Plan: Fix FFmpeg hanging at 5% during subtitle burn

### Root cause
The previous fix incorrectly removed the `workerURL` from the FFmpeg load call. The UMD build of `@ffmpeg/core@0.12.6` **does** include `ffmpeg-core.worker.js` — it's required for execution. Without it, `instance.load()` hangs silently because the internal Web Worker can't be created.

The core JS has a `_locateFile` function that looks for the worker URL:
```javascript
if (path.endsWith(".worker.js")) return workerURL;
```
When `workerURL` is undefined (because we stopped passing it), the worker fetch falls back to a relative path that doesn't resolve, causing the hang.

### Fix: `src/lib/ffmpegLoader.ts`

Re-add the worker file download and pass all three URLs to `instance.load()`:

1. Fetch `ffmpeg-core.worker.js` alongside the core JS and WASM (small file, fast)
2. Pass `{ coreURL, wasmURL, workerURL }` to `instance.load()`
3. Progress: JS at 2-4%, WASM at 4-14%, worker at 14-15%, compilation at 15-20%

### Why this was broken
The error message about "worker.js 404" was misdiagnosed — the 404 was because the file was being fetched from the wrong URL (before blob URL conversion). The file exists on both CDNs at `@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js`.

