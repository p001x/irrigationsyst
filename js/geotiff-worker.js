// AgriAdapt — GeoTIFF Web Worker
// Offloads the pixel-level band-index processing loop from the main thread,
// preventing the browser from freezing on large satellite images.

self.onmessage = function (e) {
  const { redData, nirData, greenData, width, height } = e.data;
  const pixelData = new Uint8ClampedArray(width * height * 4);
  let sumNDVI = 0, sumNDWI = 0, count = 0;

  for (let idx = 0; idx < width * height; idx++) {
    const red   = redData[idx];
    const nir   = nirData[idx];
    const green = greenData ? greenData[idx] : null;
    const denom = nir + red;
    if (denom === 0) continue;

    const ndvi = (nir - red) / denom;
    const ndwi = (green !== null && (green + nir) > 0) ? (green - nir) / (green + nir) : 0;
    sumNDVI += ndvi;
    sumNDWI += ndwi;
    count++;

    // NDVI colour-map: red → orange → yellow → green
    let r, g, b;
    if      (ndvi > 0.5) { r = 0;   g = 200; b = 80; }
    else if (ndvi > 0.3) { r = 130; g = 200; b = 0;  }
    else if (ndvi > 0.1) { r = 255; g = 165; b = 0;  }
    else                 { r = 200; g = 50;  b = 50;  }

    const p = idx * 4;
    pixelData[p]     = r;
    pixelData[p + 1] = g;
    pixelData[p + 2] = b;
    pixelData[p + 3] = 180;
  }

  const meanNDVI = count > 0 ? sumNDVI / count : 0;
  const meanNDWI = count > 0 ? sumNDWI / count : 0;

  // Transfer buffer ownership (zero-copy) back to the main thread
  self.postMessage({ pixelData, meanNDVI, meanNDWI, width, height }, [pixelData.buffer]);
};
