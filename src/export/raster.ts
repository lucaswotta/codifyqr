export function svgToBlobUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/** Draws an SVG string onto a canvas of the given pixel size. */
export async function svgToCanvas(svg: string, width: number, height = width): Promise<HTMLCanvasElement> {
  const url = svgToBlobUrl(svg);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), type);
  });
}

export async function svgToPng(svg: string, width: number, height = width): Promise<Blob> {
  return canvasToBlob(await svgToCanvas(svg, width, height));
}

/** Maximum canvas edge that every supported browser can allocate. */
export const MAX_CANVAS_EDGE = 8192;
