---
name: GeoTIFF Worker Clone Rule
description: Why typed arrays must be .slice()'d before postMessage transfer to the geotiff-worker.
---

## Rule
In `js/spectral.js`, before posting band data to the Web Worker, always `.slice()` the typed arrays:
```js
const redData = state.bandRed.data.slice();   // clone
```
Then transfer the *clone's* buffer (not the original):
```js
worker.postMessage({ redData, ... }, [redData.buffer, ...]);
```

**Why:** `postMessage` with a transfer list detaches the `ArrayBuffer` from the main thread. If you transfer `state.bandRed.data.buffer` directly, the buffer is neutered and subsequent calls to `computeBandIndex()` will throw "detached ArrayBuffer" without the user re-uploading the band files.

**How to apply:** Any time you use zero-copy transfer to a Web Worker, always clone first if the original data needs to remain accessible after posting.
