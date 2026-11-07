import type { BatchMessage, BatchRequest } from '../export/batch';
import { parseCsv, toBatchRows, uniqueFileNames } from '../export/csv';
import { fileName, saveBlob } from '../export/download';
import { imageToBitmap } from '../export/raster';
import { clear, debounce, el } from './dom';
import { t } from './i18n';
import { icon } from './icons';
import { state } from './state';

export const BATCH_LIMIT = 500;

export function createBatch(notify: (message: string, kind?: 'info' | 'error') => void): HTMLElement {
  const input = el('textarea', {
    id: 'batch-input',
    rows: 10,
    value: state.batch.input,
    placeholder: t('batch.placeholder'),
    spellcheck: false,
    'aria-describedby': 'batch-count',
  });
  const count = el('p', { class: 'field-note', id: 'batch-count', 'aria-live': 'polite' });
  const progress = el('progress', { class: 'progress', max: 1, value: 0, hidden: true });
  const status = el('p', { class: 'field-note', role: 'status', 'aria-live': 'polite' });
  const list = el('ol', { class: 'rows', 'data-empty': t('batch.idle'), 'aria-label': t('batch.rows', { n: 0 }) });
  let format: 'png' | 'svg' = state.batch.format;
  let size: 512 | 1024 | 2048 = state.batch.size;

  const rows = () => toBatchRows(parseCsv(input.value));
  const updateList = () => {
    if (input.disabled) return;
    state.batch.input = input.value;
    const all = rows();
    const n = all.length;
    count.textContent = n > BATCH_LIMIT ? t('batch.tooMany', { max: BATCH_LIMIT }) : t('batch.rows', { n });
    const names = uniqueFileNames(all.slice(0, BATCH_LIMIT), format);
    clear(list);
    for (const [i, row] of all.slice(0, BATCH_LIMIT).entries()) {
      list.append(
        el(
          'li',
          { class: 'row', 'data-state': 'idle' },
          el('span', { class: 'row-n' }, String(i + 1)),
          el('span', { class: 'row-content' }, row.content),
          el('span', { class: 'row-name' }, names[i]),
        ),
      );
    }
  };
  input.addEventListener('input', debounce(updateList, 120));
  updateList();

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
      const contents = await file.text();
      if (input.disabled) return;
      input.value = contents;
      updateList();
    },
  });

  const generate = el(
    'button',
    { type: 'button', class: 'btn btn-primary' },
    icon('download'),
    el('span', {}, t('batch.generate')),
  );
  generate.addEventListener('click', async () => {
    const all = rows().slice(0, BATCH_LIMIT);
    if (all.length === 0) return notify(t('batch.empty'), 'error');
    updateList();
    const controls = [
      input,
      fileInput,
      ...formatField.querySelectorAll('input'),
      ...sizeField.querySelectorAll('input'),
    ];
    for (const control of controls) control.disabled = true;
    generate.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = '';
    const items = [...list.children] as HTMLElement[];
    for (const item of items) item.dataset.state = 'idle';
    const request: BatchRequest = { rows: all, format, size, style: structuredClone(state.style) };
    let worker: Worker | undefined;
    let logo: ImageBitmap | undefined;
    try {
      if (format === 'png' && request.style.logo?.href.startsWith('data:image/')) {
        logo = await imageToBitmap(request.style.logo.href, size);
        request.logo = logo;
      }
      worker = new Worker(new URL('../export/batch.worker.ts', import.meta.url), { type: 'module' });
      const completed = await new Promise<Extract<BatchMessage, { type: 'done' }>>((resolve, reject) => {
        worker!.onerror = () => reject(new Error('Batch worker failed'));
        worker!.onmessageerror = () => reject(new Error('Invalid batch worker message'));
        worker!.onmessage = ({ data }: MessageEvent<BatchMessage>) => {
          if (data.type === 'error') reject(new Error('Batch rendering failed'));
          else if (data.type === 'done') resolve(data);
          else {
            if (items[data.index]) items[data.index]!.dataset.state = data.ok ? 'ok' : 'fail';
            progress.value = (data.index + 1) / all.length;
            status.textContent = t('batch.progress', { done: data.index + 1, total: all.length });
          }
        };
        worker!.postMessage(request, logo ? [logo] : []);
      });
      if (completed.zip) {
        saveBlob(completed.zip, fileName('batch', 'zip'));
        status.textContent = t('batch.done');
      }
      if (completed.failed.length > 0)
        notify(
          t('batch.failedRows', { n: completed.failed.length, list: completed.failed.slice(0, 10).join(', ') }),
          'error',
        );
    } catch {
      status.textContent = t('export.failed');
      notify(t('export.failed'), 'error');
    } finally {
      worker?.terminate();
      logo?.close();
      for (const control of controls) control.disabled = false;
      generate.disabled = false;
      progress.hidden = true;
    }
  });

  const group = <T extends string | number>(
    name: string,
    label: string,
    options: readonly T[],
    value: T,
    onPick: (o: T) => void,
  ) => {
    const box = el('div', {
      class: 'chips chips-small',
      role: 'radiogroup',
      'aria-label': label,
      'data-cols': String(options.length),
    });
    for (const option of options) {
      box.append(
        el('input', {
          type: 'radio',
          name,
          id: `${name}-${option}`,
          class: 'chip-input',
          checked: option === value,
          onchange: () => onPick(option),
        }),
        el('label', { for: `${name}-${option}`, class: 'chip' }, el('span', {}, String(option).toUpperCase())),
      );
    }
    return el('div', { class: 'field' }, el('span', { class: 'label' }, label), box);
  };
  const formatField = group('batch-format', t('batch.format'), ['png', 'svg'] as const, format, (f) => {
    format = f;
    state.batch.format = f;
    updateList();
  });
  const sizeField = group('batch-size', `${t('export.size')} (px)`, [512, 1024, 2048] as const, size, (n) => {
    size = n;
    state.batch.size = n;
  });

  return el(
    'div',
    { class: 'tool tool-batch', id: 'batch' },
    el(
      'section',
      { class: 'col' },
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
        { class: 'btn-grid' },
        fileInput,
        el('label', { for: 'batch-file', class: 'btn' }, icon('upload'), el('span', {}, t('batch.import'))),
      ),
    ),
    el('section', { class: 'col col-stage', 'aria-label': t('batch.rows', { n: 0 }) }, list),
    el(
      'aside',
      { class: 'col col-side' },
      el('h2', { class: 'section-title' }, t('export.title')),
      formatField,
      sizeField,
      el('p', { class: 'hint' }, `${t('batch.style')} ${t('batch.limit', { max: BATCH_LIMIT })}`),
      el('div', { class: 'btn-grid' }, generate),
      progress,
      status,
    ),
  );
}
