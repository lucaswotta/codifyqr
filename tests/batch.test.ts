import { describe, expect, it } from 'vitest';
import { renderBatch } from '../src/export/batch';
import { DEFAULT_STYLE } from '../src/qr/style';
import { planQr, renderQrSvg } from '../src/qr/svg';

describe('batch rendering', () => {
  it('keeps text normalization, names and progress when a row fails', async () => {
    const progress: [number, boolean][] = [];
    const completed = await renderBatch(
      {
        rows: [
          { content: 'example.com', name: 'same' },
          { content: 'x'.repeat(4000), name: 'bad' },
          { content: ' Olá 世界 ', name: 'same' },
        ],
        format: 'svg',
        size: 512,
        style: DEFAULT_STYLE,
      },
      (index, ok) => progress.push([index, ok]),
    );
    expect(progress).toEqual([
      [0, true],
      [1, false],
      [2, true],
    ]);
    expect(completed.failed).toEqual(['2']);
    const zip = Buffer.from(await completed.zip!.arrayBuffer());
    let offset = 0;
    for (const [name, text] of [
      ['same.svg', 'https://example.com'],
      ['same-2.svg', 'Olá 世界'],
    ] as const) {
      const length = zip.readUInt32LE(offset + 18);
      const nameLength = zip.readUInt16LE(offset + 26);
      expect(zip.subarray(offset + 30, offset + 30 + nameLength).toString()).toBe(name);
      const start = offset + 30 + nameLength;
      expect(zip.subarray(start, start + length).toString()).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n${renderQrSvg(planQr(text, DEFAULT_STYLE), { px: 512 })}`,
      );
      offset = start + length;
    }
    expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
  });

  it('does not download an empty archive when every row fails', async () => {
    const progress: boolean[] = [];
    const completed = await renderBatch(
      { rows: [{ content: '', name: null }], format: 'svg', size: 512, style: DEFAULT_STYLE },
      (_index, ok) => progress.push(ok),
    );
    expect(completed.zip).toBeNull();
    expect(completed.failed).toEqual(['1']);
    expect(progress).toEqual([false]);
  });
});
