

## Problem

`SecurityError: Failed to construct 'Worker': Script at 'https://cdn.jsdelivr.net/...' cannot be accessed from origin '...'`

Browsers block creating `new Worker()` from cross-origin URLs. The `classWorkerURL` is passed as a direct CDN string, which always fails.

Previous attempts to use `toBlobURL` broke relative ESM imports inside `worker.js` (it imports `./const.js`, `./errors.js`, etc.).

## Solution

Fetch the `worker.js` source text, **rewrite its relative imports** (`./const.js`, `./errors.js`, etc.) to absolute CDN URLs, then create a blob URL from the modified source. This gives us:

1. A same-origin blob URL (no SecurityError)
2. Absolute import paths that resolve correctly from inside the blob worker

## Changes

**File: `src/lib/ffmpegLoader.ts`**

In `tryLoadFromCDN`, replace the direct `classWorkerURL = classWorkerUrl` assignment with:

```typescript
// Fetch worker.js source, rewrite relative imports to absolute CDN URLs,
// then create a blob URL (same-origin, no SecurityError).
const workerBaseURL = classWorkerUrl.substring(0, classWorkerUrl.lastIndexOf('/'));
const workerResponse = await fetch(classWorkerUrl);
if (!workerResponse.ok) throw new Error(`Failed to fetch worker.js: ${workerResponse.status}`);
let workerSource = await workerResponse.text();

// Rewrite relative imports like './const.js' → absolute CDN URLs
workerSource = workerSource.replace(
  /from\s+["']\.\/([^"']+)["']/g,
  `from "${workerBaseURL}/$1"`
);
workerSource = workerSource.replace(
  /import\s+["']\.\/([^"']+)["']/g,
  `import "${workerBaseURL}/$1"`
);

const classWorkerURL = URL.createObjectURL(
  new Blob([workerSource], { type: 'text/javascript' })
);
```

This is the only file that needs to change. No other modifications required.

