import { text } from '../payloads/formats';
import { renderQrCanvas } from '../qr/canvas';
import type { QrStyle } from '../qr/style';
import { planQr, renderQrSvg } from '../qr/svg';
import { type BatchRow, uniqueFileNames } from './csv';
import { createZipBlob, type ZipEntry } from './zip';

export interface BatchRequest {
  rows: BatchRow[];
  format: 'png' | 'svg';
  size: number;
  style: QrStyle;
  logo?: ImageBitmap;
}

export type BatchMessage =
  | { type: 'progress'; index: number; ok: boolean }
  | { type: 'done'; zip: Blob | null; failed: string[] }
  | { type: 'error' };

export async function renderBatch(
  request: BatchRequest,
  progress: (index: number, ok: boolean) => void,
): Promise<Extract<BatchMessage, { type: 'done' }>> {
  const { rows, format, size, style, logo } = request;
  const names = uniqueFileNames(rows, format);
  const entries: ZipEntry[] = [];
  const failed: string[] = [];
  const canvas = format === 'png' ? new OffscreenCanvas(size, size) : null;
  for (const [index, row] of rows.entries()) {
    let ok = false;
    try {
      const built = text.build({ content: row.content });
      if (!built.ok) throw new Error('invalid');
      const plan = planQr(built.text, style);
      let data: Uint8Array;
      if (canvas) {
        renderQrCanvas(plan, canvas, logo);
        data = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
      } else {
        const svg = renderQrSvg(plan, { px: size });
        data = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`);
      }
      entries.push({ name: names[index]!, data });
      ok = true;
    } catch {
      failed.push(String(index + 1));
    }
    progress(index, ok);
  }
  return { type: 'done', zip: entries.length ? createZipBlob(entries) : null, failed };
}
