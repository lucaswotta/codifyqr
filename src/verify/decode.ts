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
