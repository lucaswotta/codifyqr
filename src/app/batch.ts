import { parseCsv, toBatchRows, uniqueFileNames } from '../export/csv';
import { fileName, saveBlob } from '../export/download';
import { svgToPng } from '../export/raster';
import { createZip } from '../export/zip';
import { PAYLOADS } from '../payloads';
import { planQr, renderQrSvg } from '../qr/svg';
import { el } from './dom';
import { t } from './i18n';
import { state } from './state';

export const BATCH_LIMIT = 500;

export function createBatch(notify: (message: string, kind?: 'info' | 'error') => void): HTMLElement {
  const input = el('textarea', {
    id: 'batch-input',
    rows: 8,
    placeholder: t('batch.placeholder'),
    spellcheck: false,
    'aria-describedby': 'batch-count',
  });
  const count = el('p', { class: 'field-note', id: 'batch-count', 'aria-live': 'polite' });
  const progress = el('progress', { class: 'progress', max: 1, value: 0, hidden: true });
  const status = el('p', { class: 'field-note', role: 'status', 'aria-live': 'polite' });
  let format: 'png' | 'svg' = 'png';
  let size = 1024;

  const rows = () => toBatchRows(parseCsv(input.value));
  const updateCount = () => {
    const n = rows().length;
    count.textContent = n > BATCH_LIMIT ? t('batch.tooMany', { max: BATCH_LIMIT }) : t('batch.rows', { n });
  };
  input.addEventListener('input', updateCount);
  updateCount();

  const fileInput = el('input', {
    type: 'file',
    id: 'batch-file',
    accept: '.csv,.txt,text/csv,text/plain',
    class: 'sr-only',
    onchange: async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      target.value = '';
      if (!file || file.size > 2 * 1024 * 1024) return;
      input.value = await file.text();
      updateCount();
    },
  });

  const generate = el('button', { type: 'button', class: 'btn btn-primary' }, t('batch.generate'));
  generate.addEventListener('click', async () => {
    const all = rows().slice(0, BATCH_LIMIT);
    if (all.length === 0) return notify(t('batch.empty'), 'error');
    generate.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = '';
    const names = uniqueFileNames(all, format);
    const entries: { name: string; data: Uint8Array }[] = [];
    const failed: string[] = [];
    try {
      for (let i = 0; i < all.length; i++) {
        const built = PAYLOADS.text.build({ content: all[i]!.content });
        try {
          if (!built.ok) throw new Error('invalid');
          const plan = planQr(built.text, state.style);
          const svg = renderQrSvg(plan, { px: size });
          const data =
            format === 'svg'
              ? new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`)
              : new Uint8Array(await (await svgToPng(svg, size)).arrayBuffer());
          entries.push({ name: names[i]!, data });
        } catch {
          failed.push(String(i + 1));
        }
        progress.value = (i + 1) / all.length;
        status.textContent = t('batch.progress', { done: i + 1, total: all.length });
        if (i % 4 === 3) await new Promise((r) => setTimeout(r));
      }
      if (entries.length > 0) {
        saveBlob(new Blob([createZip(entries) as BlobPart], { type: 'application/zip' }), fileName('batch', 'zip'));
        status.textContent = t('batch.done');
      }
      if (failed.length > 0)
        notify(t('batch.failedRows', { n: failed.length, list: failed.slice(0, 10).join(', ') }), 'error');
    } finally {
      generate.disabled = false;
      progress.hidden = true;
    }
  });

  const formatSelect = el(
    'select',
    { id: 'batch-format', onchange: (e: Event) => (format = (e.target as HTMLSelectElement).value as 'png' | 'svg') },
    el('option', { value: 'png' }, 'PNG'),
    el('option', { value: 'svg' }, 'SVG'),
  );
  const sizeSelect = el(
    'select',
    { id: 'batch-size', onchange: (e: Event) => (size = Number((e.target as HTMLSelectElement).value)) },
    ...[512, 1024, 2048].map((s) => el('option', { value: String(s), selected: s === size }, `${s} px`)),
  );

  return el(
    'section',
    { class: 'tool', id: 'batch' },
    el('h2', { class: 'section-title' }, t('batch.title')),
    el('p', { class: 'lead' }, t('batch.lead')),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'batch-input', class: 'sr-only' }, t('batch.title')),
      input,
      count,
    ),
    el(
      'div',
      { class: 'export-row' },
      fileInput,
      el('label', { for: 'batch-file', class: 'btn' }, t('batch.import')),
      el('label', { class: 'inline-field', for: 'batch-format' }, t('batch.format'), formatSelect),
      el('label', { class: 'inline-field', for: 'batch-size' }, t('export.size'), sizeSelect),
    ),
    el('p', { class: 'hint' }, `${t('batch.style')} ${t('batch.limit', { max: BATCH_LIMIT })}`),
    el('div', { class: 'export-row' }, generate),
    progress,
    status,
  );
}
