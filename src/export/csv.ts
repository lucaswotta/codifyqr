export interface BatchRow {
  content: string;
  name: string | null;
}

/** Minimal RFC 4180 parser. Accepts comma, semicolon or tab separators and a UTF-8 BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t']
    .map((d) => [d, firstLine.split(d).length] as const)
    .sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_NAMES = new Set(['content', 'conteudo', 'conteúdo', 'contenido', 'url', 'text', 'texto']);

/** First column is the content, the optional second is the file name. A header row is skipped. */
export function toBatchRows(rows: string[][]): BatchRow[] {
  const body = rows.length > 0 && HEADER_NAMES.has((rows[0]![0] ?? '').trim().toLowerCase()) ? rows.slice(1) : rows;
  return body
    .map((r) => ({ content: (r[0] ?? '').trim(), name: (r[1] ?? '').trim() || null }))
    .filter((r) => r.content !== '');
}

/** Safe, unique file names: no paths, no reserved characters, no empty names. */
export function uniqueFileNames(rows: readonly BatchRow[], ext: string): string[] {
  const used = new Set<string>();
  return rows.map((row, i) => {
    const base =
      (row.name ?? '')
        .normalize('NFKD')
        .replace(/[^\w.\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/^\.+/, '')
        .slice(0, 60) || `code-${String(i + 1).padStart(3, '0')}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}`;
    used.add(name.toLowerCase());
    return `${name}.${ext}`;
  });
}
