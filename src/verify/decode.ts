type JsQr = typeof import('jsqr').default;
let jsqr: Promise<JsQr> | null = null;

const loadJsQr = (): Promise<JsQr> => {
  jsqr ??= import('jsqr').then((m) => m.default);
  return jsqr;
};

interface NativeDetector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: (new (options: { formats: string[] }) => NativeDetector) | undefined;

let native: NativeDetector | null | undefined;
function nativeDetector(): NativeDetector | null {
  if (native !== undefined) return native;
  try {
    native = typeof BarcodeDetector === 'function' ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  } catch {
    native = null;
  }
  return native;
}

export interface DecodeOptions {
  /** Also try light-on-dark codes. The verifier leaves this off to stay conservative. */
  invert?: boolean;
}

/** Decodes with the platform detector when there is one and falls back to jsQR. */
export async function decodeCanvas(
  canvas: HTMLCanvasElement,
  { invert = false }: DecodeOptions = {},
): Promise<string | null> {
  const detector = nativeDetector();
  if (detector) {
    try {
      const found = await detector.detect(canvas);
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch {
      // The platform detector can reject unsupported sources; jsQR covers that case.
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const decode = await loadJsQr();
  return (
    decode(image.data, image.width, image.height, { inversionAttempts: invert ? 'attemptBoth' : 'dontInvert' })?.data ??
    null
  );
}

/**
 * Camera apps retry with softened frames. jsQR alone misses styled codes at some sizes that
 * ZXing-based readers handle, so the verifier tries the raw frame, then blurred and halved copies.
 */
export async function decodeWithRetries(
  canvas: HTMLCanvasElement,
  options: DecodeOptions = {},
): Promise<string | null> {
  const direct = await decodeCanvas(canvas, options);
  if (direct !== null) return direct;

  const attempts: { scale: number; blur: number }[] = [
    { scale: 1, blur: 0.8 },
    { scale: 1, blur: 1.6 },
    { scale: 0.5, blur: 0 },
    { scale: 0.5, blur: 0.8 },
  ];
  for (const { scale, blur } of attempts) {
    const copy = document.createElement('canvas');
    copy.width = Math.max(32, Math.round(canvas.width * scale));
    copy.height = Math.max(32, Math.round(canvas.height * scale));
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, copy.width, copy.height);
    if (blur > 0 && 'filter' in ctx) ctx.filter = `blur(${blur}px)`;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
    const text = await decodeCanvas(copy, options);
    if (text !== null) return text;
  }
  return null;
}
