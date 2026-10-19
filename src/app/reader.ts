import { decodeCanvas } from '../verify/decode';
import { analyzeScan, type ScanAnalysis } from '../verify/scan';
import { clear, el, put } from './dom';
import { t } from './i18n';
import { icon } from './icons';

export function createReader(notify: (message: string, kind?: 'info' | 'error') => void): HTMLElement {
  const video = el('video', {
    class: 'reader-video',
    playsinline: true,
    muted: true,
    hidden: true,
    'aria-label': t('scan.title'),
  });
  const canvas = document.createElement('canvas');
  const resultHost = el('div', { class: 'scan-result', 'data-empty': t('scan.empty'), 'aria-live': 'polite' });
  const previewBox = el('div', { class: 'preview-box scan-preview' });
  const placeholder = el('p', { class: 'stage-empty' }, icon('scan'), el('span', {}, t('scan.lead')));
  let shownUrl: string | null = null;
  let stream: MediaStream | null = null;
  let running = false;

  const cameraBtn = el(
    'button',
    { type: 'button', class: 'btn btn-primary' },
    icon('camera'),
    el('span', {}, t('scan.camera')),
  );
  const supportsCamera = !!navigator.mediaDevices?.getUserMedia;

  function stopCamera(): void {
    running = false;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    cameraBtn.replaceChildren(icon('camera'), el('span', {}, t('scan.camera')));
  }

  let starting = false;

  async function startCamera(): Promise<void> {
    if (running || starting) return;
    if (!supportsCamera) return notify(t('scan.unsupported'), 'error');
    starting = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      starting = false;
      return notify(t('scan.permission'), 'error');
    }
    // Attach the element before giving it the stream; moving it afterwards would interrupt play().
    clear(previewBox);
    put(previewBox, video);
    video.hidden = false;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      // AbortError means the camera was stopped while starting; anything else is a real failure.
      if ((error as DOMException).name !== 'AbortError') {
        stopCamera();
        notify(t('scan.permission'), 'error');
      }
    }
    starting = false;
    if (!stream) return;
    cameraBtn.replaceChildren(icon('camera'), el('span', {}, t('scan.stop')));
    running = true;
    void loop();
  }

  async function loop(): Promise<void> {
    while (running) {
      await new Promise((r) => setTimeout(r, 140));
      if (!running || video.videoWidth === 0) continue;
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const text = await decodeCanvas(canvas, { invert: true });
      if (text) {
        stopCamera();
        showResult(text);
        return;
      }
    }
  }

  cameraBtn.addEventListener('click', () => (running ? stopCamera() : void startCamera()));

  async function readImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return;
    const url = URL.createObjectURL(file);
    if (shownUrl) URL.revokeObjectURL(shownUrl);
    shownUrl = url;
    clear(previewBox);
    previewBox.append(el('img', { class: 'qr-img', src: url, alt: file.name }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const text = await decodeCanvas(canvas, { invert: true });
      if (text) showResult(text);
      else {
        clear(resultHost);
        notify(t('scan.none'), 'error');
      }
    } catch {
      notify(t('scan.none'), 'error');
    }
  }

  function showResult(text: string): void {
    const info: ScanAnalysis = analyzeScan(text);
    clear(resultHost);
    const warnings = info.warnings.length
      ? el(
          'div',
          { class: 'scan-warn', role: 'alert' },
          el('p', { class: 'scan-warn-title' }, t('scan.warn.title')),
          el('ul', {}, ...info.warnings.map((w) => el('li', {}, t(`scan.warn.${w}`)))),
        )
      : null;
    const copyBtn = el('button', { type: 'button', class: 'btn' }, t('scan.copy'));
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        notify(t('scan.copied'));
      } catch {
        notify(text);
      }
    });
    put(
      resultHost,
      el('h3', { class: 'subtitle' }, t('scan.result')),
      el('p', { class: 'field-note' }, `${t('scan.type')}: ${t(`scan.kind.${info.kind}`)}`),
      el('pre', { class: 'scan-text', tabindex: 0 }, text),
      warnings,
      el(
        'div',
        { class: 'btn-grid' },
        copyBtn,
        info.url
          ? el(
              'a',
              { class: 'btn', href: info.url, target: '_blank', rel: 'noopener noreferrer nofollow' },
              info.warnings.length ? t('scan.openCareful') : t('scan.open'),
            )
          : null,
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: () => {
              clear(resultHost);
              if (supportsCamera) void startCamera();
            },
          },
          t('scan.again'),
        ),
      ),
    );
  }

  const fileInput = el('input', {
    type: 'file',
    id: 'scan-file',
    accept: 'image/*',
    class: 'sr-only',
    onchange: (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (f) void readImage(f);
    },
  });
  const drop = el('div', { class: 'drop', tabindex: -1 }, t('scan.drop'));
  for (const type of ['dragenter', 'dragover'])
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = (e as DragEvent).dataTransfer?.files[0];
    if (f) void readImage(f);
  });

  put(previewBox, placeholder, video);
  const section = el(
    'div',
    { class: 'tool tool-scan', id: 'scan' },
    el(
      'section',
      { class: 'col' },
      el('h2', { class: 'section-title' }, t('scan.title')),
      el('p', { class: 'lead' }, t('scan.lead')),
      el(
        'div',
        { class: 'btn-grid' },
        supportsCamera ? cameraBtn : null,
        fileInput,
        el('label', { for: 'scan-file', class: 'btn' }, icon('file'), el('span', {}, t('scan.file'))),
      ),
      drop,
    ),
    el('section', { class: 'col col-stage', 'aria-label': t('scan.title') }, previewBox),
    el('aside', { class: 'col col-side' }, resultHost),
  );
  // Release the camera when the tool is hidden or the page goes away.
  window.addEventListener('pagehide', stopCamera);
  new MutationObserver(() => section.hidden && stopCamera()).observe(section, {
    attributes: true,
    attributeFilter: ['hidden'],
  });
  return section;
}
