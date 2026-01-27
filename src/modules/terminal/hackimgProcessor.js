// Simple image processing utilities for the hackimg command.
// Works in the browser using Canvas. All operations are deterministic and reversible.

export async function loadImageData(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({ data, canvas, ctx });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error('No se pudo cargar la imagen: ' + src));
    img.src = src;
  });
}

function egcd(a, b) {
  if (b === 0) return [a, 1, 0];
  const [g, x1, y1] = egcd(b, a % b);
  return [g, y1, x1 - Math.floor(a / b) * y1];
}

function modInverse(a, m) {
  const [g, x] = egcd(a, m);
  if (g !== 1) return null;
  return ((x % m) + m) % m;
}

export function permutePixelsInvert(imageData, key) {
  // Decrypt permutation: encryption wrote encrypted[(i*k)%N] = original[i]
  // So to recover original[i] we read encrypted[(i*k)%N]
  const data = imageData.data;
  const pixels = data.length / 4;
  // ensure key is coprime with pixels (like the encryptor does)
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let k = key;
  while (gcd(k, pixels) !== 1) k += 2;
  const copy = new Uint8ClampedArray(data);
  for (let i = 0; i < pixels; i++) {
    const src = (i * k) % pixels; // position in encrypted image that holds original[i]
    data[i * 4 + 0] = copy[src * 4 + 0];
    data[i * 4 + 1] = copy[src * 4 + 1];
    data[i * 4 + 2] = copy[src * 4 + 2];
    data[i * 4 + 3] = copy[src * 4 + 3];
  }
}

export function xorColors(imageData, key) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] ^= key;
    data[i + 1] ^= key;
    data[i + 2] ^= key;
  }
}

export function blocksInvert(imageData, blockSize = 8) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;
  const blocksX = Math.ceil(w / blockSize);
  const blocksY = Math.ceil(h / blockSize);
  const totalBlocks = blocksX * blocksY;
  // To invert blocksReorder (which wrote encrypted[dst] = original[src])
  // we need to set original[src] = encrypted[dst]. So read from copy[dst] into data[src].
  const copy = new Uint8ClampedArray(data);
  const getBlockIndex = (bx, by) => by * blocksX + bx;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const srcIndex = getBlockIndex(bx, by);
      const dstIndex = totalBlocks - 1 - srcIndex; // reverse order used in encryption
      const dstB_x = dstIndex % blocksX;
      const dstB_y = Math.floor(dstIndex / blocksX);
      // copy block from encrypted dst -> original src
      for (let yy = 0; yy < blockSize; yy++) {
        for (let xx = 0; xx < blockSize; xx++) {
          const sx = bx * blockSize + xx;
          const sy = by * blockSize + yy;
          const dx = dstB_x * blockSize + xx;
          const dy = dstB_y * blockSize + yy;
          if (sx >= w || sy >= h || dx >= w || dy >= h) continue;
          const sIdx = (sy * w + sx) * 4; // original position
          const dIdx = (dy * w + dx) * 4; // encrypted position
          data[sIdx] = copy[dIdx];
          data[sIdx + 1] = copy[dIdx + 1];
          data[sIdx + 2] = copy[dIdx + 2];
          data[sIdx + 3] = copy[dIdx + 3];
        }
      }
    }
  }
}

export async function applyDecryptionSequence(imgSrc, methods = []) {
  // imgSrc is a URL relative to app root (e.g., 'img/encrypted.jpg')
  const loaded = await loadImageData(imgSrc);
  const { data: imageData, canvas, ctx } = loaded;
  // define deterministic keys
  const permuteKey = 4999; // will adjust if not coprime
  const xorKey = 73;
  const blockSize = 8;

  // apply methods in the given order (we treat them as decryption steps)
  for (const m of methods) {
    if (!m) continue;
    const mm = m.trim().toLowerCase();
    if (mm === 'permute') {
      // inverse permutation
      permutePixelsInvert(imageData, permuteKey);
    } else if (mm === 'xor') {
      xorColors(imageData, xorKey);
    } else if (mm === 'blocks') {
      blocksInvert(imageData, blockSize);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
