import jsQR from 'jsqr';
import type { QrMatrix } from '../src/qr/encoder';

export function rasterize(matrix: QrMatrix, scale = 4, quiet = 4): { data: Uint8ClampedArray; width: number } {
  const width = (matrix.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (quiet + x) * scale + dx;
          const py = (quiet + y) * scale + dy;
          const i = (py * width + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

export function decode(matrix: QrMatrix, scale = 4): string | null {
  const { data, width } = rasterize(matrix, scale);
  return jsQR(data, width, width)?.data ?? null;
}
