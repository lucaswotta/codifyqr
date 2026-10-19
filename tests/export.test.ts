import { describe, expect, it } from 'vitest';
import { parseCsv, toBatchRows, uniqueFileNames } from '../src/export/csv';
import { crc32, createZip, createZipBlob } from '../src/export/zip';

describe('zip', () => {
  it('computes the standard CRC32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a readable archive', async () => {
    const entries = [
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'ç.txt', data: new Uint8Array([1, 2, 3]) },
    ];
    const stamp = new Date(2026, 9, 19, 10, 30, 0);
    const zip = createZip(entries, stamp);
    const blobBytes = new Uint8Array(await createZipBlob(entries, stamp).arrayBuffer());
    expect(blobBytes).toEqual(zip);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(2);
    expect(new TextDecoder().decode(zip.slice(30, 35))).toBe('a.txt');
  });
});

describe('csv', () => {
  it('handles quotes, separators and a BOM', () => {
    const rows = parseCsv('﻿content;name\r\n"a;b";"say ""hi"""\r\nhttps://x.co;\r\n');
    expect(rows).toEqual([
      ['content', 'name'],
      ['a;b', 'say "hi"'],
      ['https://x.co', ''],
    ]);
    expect(toBatchRows(rows)).toEqual([
      { content: 'a;b', name: 'say "hi"' },
      { content: 'https://x.co', name: null },
    ]);
  });

  it('builds safe unique names', () => {
    const names = uniqueFileNames(
      [
        { content: 'a', name: '../etc/passwd' },
        { content: 'b', name: 'Loja Centro' },
        { content: 'c', name: 'loja centro' },
        { content: 'd', name: null },
      ],
      'png',
    );
    expect(names).toEqual(['etcpasswd.png', 'Loja-Centro.png', 'loja-centro-2.png', 'code-004.png']);
  });
});

import { buildPdf, pdfDpi } from '../src/export/pdf';

describe('pdf', () => {
  it('writes a structurally valid one page file', async () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const blob = await buildPdf({ width: 4, height: 4, data, widthMm: 50, heightMm: 50 }, 'Teste (ç)');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(6);
    for (const [i, offset] of entries.entries()) expect(text.slice(offset, offset + 7)).toBe(`${i + 1} 0 obj`);
    expect(text).toContain('/MediaBox [0 0 141.73 141.73]');
    expect(text).toContain('/Filter /FlateDecode');
  });

  it('caps the resolution by page area', () => {
    expect(pdfDpi(50, 50, true)).toBe(600);
    expect(pdfDpi(210, 297, true)).toBeLessThanOrEqual(460);
    expect(pdfDpi(210, 297, false)).toBeLessThanOrEqual(150);
  });
});
