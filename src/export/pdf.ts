export interface RasterPage {
  width: number;
  height: number;
  /** RGBA pixels, already flattened on white. */
  data: Uint8ClampedArray;
  widthMm: number;
  heightMm: number;
}

const mmToPt = (mm: number) => (mm / 25.4) * 72;
const ascii = (s: string) => new TextEncoder().encode(s);

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function pdfString(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
}

/** One-page PDF with the page raster as an image that fills the page. */
export async function buildPdf(page: RasterPage, title: string): Promise<Blob> {
  const { width, height, data } = page;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!;
    rgb[j + 1] = data[i + 1]!;
    rgb[j + 2] = data[i + 2]!;
  }
  const compressed = await deflate(rgb);
  const body = compressed ?? rgb;
  const filter = compressed ? '/Filter /FlateDecode ' : '';

  const w = mmToPt(page.widthMm).toFixed(2);
  const h = mmToPt(page.heightMm).toFixed(2);
  const content = ascii(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, ...parts: Uint8Array[]) => {
    offsets[n] = length;
    push(ascii(`${n} 0 obj\n`));
    for (const p of parts) push(p);
    push(ascii('\nendobj\n'));
  };

  push(ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  object(1, ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  object(
    3,
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    ),
  );
  object(4, ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream'));
  object(
    5,
    ascii(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 ${filter}/Length ${body.length} >>\nstream\n`,
    ),
    body,
    ascii('\nendstream'),
  );
  object(6, ascii(`<< /Title (${pdfString(title)}) /Producer (CodifyQR) >>`));

  const xref = length;
  let table = `xref\n0 7\n0000000000 65535 f \n`;
  for (let n = 1; n <= 6; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(ascii(`${table}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`));

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export interface Paper {
  id: string;
  widthMm: number;
  heightMm: number;
}

export const PAPERS: readonly Paper[] = [
  { id: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'A6', widthMm: 105, heightMm: 148 },
];

/** Dots per inch for a page, capped so the canvas stays below ~20 million pixels. */
export function pdfDpi(widthMm: number, heightMm: number, canCompress: boolean): number {
  const area = (widthMm / 25.4) * (heightMm / 25.4);
  if (!canCompress) return Math.min(150, Math.floor(Math.sqrt(4_000_000 / area)));
  return Math.max(72, Math.min(600, Math.floor(Math.sqrt(20_000_000 / area))));
}
