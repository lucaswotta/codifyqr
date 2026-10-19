import fail from '../assets/mascot-fail.svg';
import ok from '../assets/mascot-ok.svg';
import risk from '../assets/mascot-risk.svg';
import { fileName, saveBlob } from '../export/download';
import { MAX_CANVAS_EDGE, svgToBlobUrl, svgToCanvas, svgToPng } from '../export/raster';
import { type BuildResult, PAYLOAD_KINDS, PAYLOADS, type PayloadKind } from '../payloads';
import { classifyPixKey } from '../payloads/pix';
import { DataTooLongError } from '../qr/encoder';
import { EYE_BALL_SHAPES, EYE_FRAME_SHAPES, MAX_LOGO_RATIO, MODULE_SHAPES, type QrStyle } from '../qr/style';
import { planQr, type QrPlan, renderQrSvg } from '../qr/svg';
import { type Composition, composeFrame, embedSvg, FRAME_IDS, type FrameId, type FrameText } from '../qr/templates';
import { type FixSuggestion, suggestFix, type VerifyResult, verifyQr } from '../verify/verify';
import { clear, debounce, el, put } from './dom';
import { has, t } from './i18n';
import { type IconName, icon } from './icons';
import { singleKeys } from './prefs';
import { state, valuesFor } from './state';
import {
  COLOR_PRESETS,
  exportStyleJson,
  importStyleJson,
  loadSavedStyles,
  type SavedStyle,
  saveStyles,
  styleToHash,
} from './stylestore';

const MASCOTS = { ok, risk, fail } as const;
const PNG_SIZES = [512, 1024, 2048, 4096] as const;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

interface Current {
  text: string;
  plan: QrPlan;
  composition: Composition;
  /** Standalone SVG file content, sized for use outside the page. */
  fileSvg: string;
}

export function createStudio(notify: (message: string, kind?: 'info' | 'error') => void): HTMLElement {
  let current: Current | null = null;
  let previewUrl: string | null = null;
  let verifyToken = 0;
  let lastVerify: VerifyResult | null = null;
  let suggestion: FixSuggestion | null = null;

  const root = el('div', { class: 'studio' });

  // ---------- Stage (preview) and side column (verifier, export) ----------
  const previewImg = el('img', { class: 'qr-img', alt: t('stage.alt'), hidden: true });
  const emptyText = el('p', { class: 'stage-empty' }, icon('create'), el('span', {}, t('stage.empty')));
  const errorText = el('p', { class: 'stage-error', role: 'alert', hidden: true });
  const previewBox = el('div', { class: 'preview-box' }, previewImg, emptyText, errorText);
  const infoLine = el('p', { class: 'stage-info' });

  const mascotImg = el('img', { class: 'mascot', alt: '', width: 56, height: 56 });
  const verifyTitle = el('p', { class: 'verify-title' });
  const verifyDetail = el('p', { class: 'verify-detail' });
  const verifyCauses = el('ul', { class: 'verify-causes' });
  const fixButton = el('button', { type: 'button', class: 'btn btn-small', hidden: true });
  const verifyBox = el(
    'section',
    { class: 'verify', 'aria-live': 'polite', 'data-state': 'empty' },
    mascotImg,
    el('div', { class: 'verify-body' }, verifyTitle, verifyDetail, verifyCauses, fixButton),
  );

  const sizeGroup = el('div', { class: 'chips chips-small', role: 'radiogroup', 'aria-label': t('export.size') });
  sizeGroup.style.setProperty('--n', String(PNG_SIZES.length));
  for (const size of PNG_SIZES) {
    sizeGroup.append(
      el('input', {
        type: 'radio',
        name: 'pngsize',
        id: `png-size-${size}`,
        class: 'chip-input',
        checked: size === state.pngSize,
        onchange: () => {
          state.pngSize = size;
        },
      }),
      el('label', { for: `png-size-${size}`, class: 'chip' }, el('span', {}, String(size))),
    );
  }
  const action = (cls: string, label: string, name: IconName, onclick: () => void) =>
    el('button', { type: 'button', class: cls, onclick }, icon(name), el('span', {}, label));
  const btnPng = action('btn btn-primary', t('export.png'), 'png', () => void exportPng());
  const btnSvg = action('btn', t('export.svg'), 'svg', () => exportSvg());
  const btnPdf = action('btn', t('export.pdf'), 'pdf', () => openPdfDialog());
  const btnCopy = action('btn', t('export.copy'), 'copy', () => void copyImage());
  const btnShare = action('btn', t('export.share'), 'share', () => void shareImage());
  btnShare.hidden = !(typeof navigator.share === 'function' && typeof navigator.canShare === 'function');
  const exportBox = el(
    'section',
    { class: 'export' },
    el('h2', { class: 'section-title' }, t('export.title')),
    el('div', { class: 'btn-grid' }, btnPng, btnSvg, btnPdf),
    el('div', { class: 'btn-grid' }, btnCopy, btnShare),
    el('div', { class: 'field' }, el('span', { class: 'label' }, `${t('export.size')} (px)`), sizeGroup),
  );

  const stage = el('section', { class: 'col col-stage', 'aria-label': t('stage.title') }, previewBox, infoLine);
  const side = el('aside', { class: 'col col-side' }, verifyBox, exportBox);

  // ---------- Controls ----------
  const kindGroup = el('div', { class: 'type-grid', role: 'radiogroup', 'aria-label': t('kind.label') });
  const fieldsHost = el('div', { class: 'fields' });
  const styleHost = el('div', { class: 'style-panel' });
  const frameHost = el('div', { class: 'frame-panel' });

  function selectKind(kind: PayloadKind): void {
    state.kind = kind;
    renderFields();
    renderFrame();
    refresh();
    setPanel('content');
  }

  function renderKinds(): void {
    clear(kindGroup);
    for (const kind of PAYLOAD_KINDS) {
      const id = `kind-${kind}`;
      kindGroup.append(
        el('input', {
          type: 'radio',
          name: 'kind',
          id,
          class: 'chip-input',
          value: kind,
          checked: state.kind === kind,
          onchange: () => selectKind(kind),
        }),
        el('label', { for: id, class: 'chip type-tile' }, icon(kind), el('span', {}, t(`kind.${kind}`))),
      );
    }
  }

  const labelFor = (kind: PayloadKind, name: string): string =>
    has(`field.${kind}.${name}`) ? t(`field.${kind}.${name}`) : t(`field.${name}`);
  const placeholderFor = (kind: PayloadKind, name: string, values: Record<string, string>): string => {
    if (name === 'id') return t(`ph.id.${values.store === 'ios' ? 'ios' : 'play'}`);
    if (has(`ph.${kind}.${name}`)) return t(`ph.${kind}.${name}`);
    if (has(`ph.${name}`)) return t(`ph.${name}`);
    return '';
  };

  const errorNodes = new Map<string, HTMLElement>();
  const inputNodes = new Map<string, HTMLElement>();
  let pixNote: HTMLElement | null = null;
  let textNote: HTMLElement | null = null;

  function renderFields(): void {
    clear(fieldsHost);
    errorNodes.clear();
    inputNodes.clear();
    pixNote = null;
    textNote = null;
    const kind = state.kind;
    const spec = PAYLOADS[kind];
    const values = valuesFor(kind);

    if (kind === 'pix') fieldsHost.append(el('p', { class: 'hint' }, t('hint.pix')));
    if (kind === 'wifi') fieldsHost.append(el('p', { class: 'hint' }, t('hint.wifi')));

    for (const field of spec.fields) {
      const id = `f-${kind}-${field.name}`;
      const errorId = `${id}-err`;
      const error = el('p', { class: 'field-error', id: errorId, hidden: true });
      errorNodes.set(field.name, error);
      const onValue = (value: string) => {
        values[field.name] = value;
        state.touched.add(`${kind}.${field.name}`);
        if (kind === 'pix' && field.name === 'key') updatePixNote();
        if (kind === 'app' && field.name === 'store') {
          const idInput = inputNodes.get('id') as HTMLInputElement | undefined;
          if (idInput) idInput.placeholder = placeholderFor(kind, 'id', values);
        }
        refresh();
      };

      let control: HTMLElement;
      let row: HTMLElement;
      if (field.type === 'checkbox') {
        control = el('input', {
          type: 'checkbox',
          id,
          checked: values[field.name] === 'true',
          onchange: (e: Event) => onValue((e.target as HTMLInputElement).checked ? 'true' : ''),
        });
        row = el(
          'div',
          { class: 'field field-check' },
          el('label', { class: 'check', for: id }, control, labelFor(kind, field.name)),
          error,
        );
      } else {
        const common = {
          id,
          'aria-describedby': errorId,
          autocomplete: field.autocomplete ?? 'off',
          placeholder: placeholderFor(kind, field.name, values),
          maxlength: field.maxLength,
          inputmode: field.inputMode,
          onblur: () => {
            state.touched.add(`${kind}.${field.name}`);
            renderErrors(lastBuild);
          },
        };
        if (field.type === 'textarea') {
          control = el('textarea', {
            ...common,
            rows: 3,
            value: values[field.name] ?? '',
            oninput: (e: Event) => onValue((e.target as HTMLTextAreaElement).value),
          });
        } else if (field.type === 'select') {
          control = el(
            'select',
            { id, onchange: (e: Event) => onValue((e.target as HTMLSelectElement).value) },
            ...(field.options ?? []).map((o) =>
              el(
                'option',
                { value: o, selected: (values[field.name] ?? field.value) === o },
                t(`opt.${field.name}.${o}`),
              ),
            ),
          );
        } else {
          control = el('input', {
            ...common,
            type: field.type === 'password' ? 'text' : field.type,
            value: values[field.name] ?? '',
            oninput: (e: Event) => onValue((e.target as HTMLInputElement).value),
          });
          if (field.type === 'password') control.setAttribute('data-secret', '');
        }
        row = el(
          'div',
          { class: 'field' },
          el(
            'label',
            { for: id },
            labelFor(kind, field.name),
            field.required ? el('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null,
          ),
          control,
          error,
        );
      }
      inputNodes.set(field.name, control);
      fieldsHost.append(row);
      if (kind === 'text') {
        textNote = el('p', { class: 'field-note', 'aria-live': 'polite' });
        fieldsHost.append(textNote);
      }
      if (kind === 'pix' && field.name === 'key') {
        pixNote = el('p', { class: 'field-note', 'aria-live': 'polite' });
        fieldsHost.append(pixNote);
        updatePixNote();
      }
    }
  }

  function updatePixNote(): void {
    if (!pixNote) return;
    const key = classifyPixKey(valuesFor('pix').key ?? '');
    pixNote.textContent = key ? t(`hint.pix.type.${key.type}`) : '';
  }

  let lastBuild: BuildResult | null = null;
  function renderErrors(result: BuildResult | null): void {
    for (const [name, node] of errorNodes) {
      const code = result && !result.ok ? result.errors[name] : undefined;
      const show = !!code && state.touched.has(`${state.kind}.${name}`);
      node.hidden = !show;
      node.textContent = show ? t(`err.${code}`) : '';
      const input = inputNodes.get(name);
      if (input) input.setAttribute('aria-invalid', show ? 'true' : 'false');
    }
  }

  // ---------- Style panel ----------
  function colorField(labelKey: string, value: string, onInput: (v: string) => void, id: string): HTMLElement {
    return el(
      'label',
      { class: 'color-field', for: id },
      el('span', {}, t(labelKey)),
      el('input', { type: 'color', id, value, oninput: (e: Event) => onInput((e.target as HTMLInputElement).value) }),
    );
  }

  function chipRow<T extends string>(
    name: string,
    labelKey: string,
    options: readonly T[],
    value: T,
    textKey: (o: T) => string,
    onPick: (o: T) => void,
    iconOf?: (o: T) => IconName | null,
  ): HTMLElement {
    const group = el('div', { class: 'chips chips-small', role: 'radiogroup', 'aria-label': t(labelKey) });
    group.style.setProperty('--n', String(options.length <= 5 ? options.length : 3));
    for (const option of options) {
      const id = `${name}-${option}`;
      group.append(
        el('input', {
          type: 'radio',
          name,
          id,
          class: 'chip-input',
          checked: value === option,
          onchange: () => onPick(option),
        }),
        el(
          'label',
          { for: id, class: iconOf ? 'chip chip-icon' : 'chip' },
          iconOf?.(option) ? icon(iconOf(option)!) : null,
          el('span', {}, t(textKey(option))),
        ),
      );
    }
    return el('div', { class: 'field' }, el('span', { class: 'label' }, t(labelKey)), group);
  }

  function setStyle(patch: Partial<QrStyle>, rerender = false): void {
    state.style = { ...state.style, ...patch };
    if (rerender) renderStyle();
    refresh();
  }

  let logoNote: HTMLElement | null = null;

  function renderStyle(): void {
    clear(styleHost);
    const s = state.style;

    const presets = el('div', { class: 'swatches', role: 'group', 'aria-label': t('style.presets') });
    for (const p of COLOR_PRESETS) {
      presets.append(
        el('button', {
          type: 'button',
          class: 'swatch',
          'data-preset': p.id,
          'aria-label': t(`preset.${p.id}`),
          title: t(`preset.${p.id}`),
          'data-fg': p.fg,
          onclick: () => setStyle({ fg: p.fg, fg2: p.fg2, bg: p.bg }, true),
        }),
      );
    }
    for (const swatch of Array.from(presets.children) as HTMLElement[]) {
      const preset = COLOR_PRESETS.find((p) => p.id === swatch.dataset.preset);
      if (preset) {
        swatch.style.setProperty('--sw1', preset.fg);
        swatch.style.setProperty('--sw2', preset.fg2 ?? preset.fg);
        swatch.style.setProperty('--sw3', preset.bg ?? '#ffffff');
      }
    }

    const gradient = s.fg2 ? s.gradient : 'none';
    put(
      styleHost,
      chipRow(
        'shape',
        'style.shape',
        MODULE_SHAPES,
        s.shape,
        (o) => `shape.${o}`,
        (shape) => setStyle({ shape }),
        (o) => o,
      ),
      chipRow(
        'eyeFrame',
        'style.eyeFrame',
        EYE_FRAME_SHAPES,
        s.eyeFrame,
        (o) => `eye.${o}`,
        (eyeFrame) => setStyle({ eyeFrame }),
        (o) => (o === 'square' ? 'ring' : o === 'rounded' ? 'ringRound' : 'circle'),
      ),
      chipRow(
        'eyeBall',
        'style.eyeBall',
        EYE_BALL_SHAPES,
        s.eyeBall,
        (o) => `eye.${o}`,
        (eyeBall) => setStyle({ eyeBall }),
        (o) => o,
      ),
      el('div', { class: 'field' }, el('span', { class: 'label' }, t('style.presets')), presets),
      el(
        'div',
        { class: 'color-row' },
        colorField('style.fg', s.fg, (fg) => setStyle({ fg }), 'c-fg'),
        colorField('style.bg', s.bg ?? '#ffffff', (bg) => setStyle({ bg }, false), 'c-bg'),
      ),
      el(
        'label',
        { class: 'check', for: 'c-transparent' },
        el('input', {
          type: 'checkbox',
          id: 'c-transparent',
          checked: s.bg === null,
          onchange: (e: Event) => setStyle({ bg: (e.target as HTMLInputElement).checked ? null : '#ffffff' }, true),
        }),
        t('style.transparent'),
      ),
      chipRow(
        'gradient',
        'style.gradient',
        ['none', 'linear', 'radial'] as const,
        gradient,
        (o) => `style.gradient.${o}`,
        (g) => {
          if (g === 'none') setStyle({ fg2: null }, true);
          else setStyle({ fg2: s.fg2 ?? '#0e7490', gradient: g }, true);
        },
      ),
      s.fg2
        ? el(
            'div',
            { class: 'color-row' },
            colorField('style.fg2', s.fg2, (fg2) => setStyle({ fg2 }), 'c-fg2'),
            s.gradient === 'linear'
              ? el(
                  'label',
                  { class: 'range-field', for: 'r-angle' },
                  el('span', {}, t('style.angle')),
                  el('input', {
                    type: 'range',
                    id: 'r-angle',
                    min: 0,
                    max: 360,
                    step: 15,
                    value: String(s.gradientAngle),
                    oninput: (e: Event) => setStyle({ gradientAngle: Number((e.target as HTMLInputElement).value) }),
                  }),
                )
              : null,
          )
        : null,
      el(
        'div',
        { class: 'color-row' },
        colorField('style.eyeColor', s.eyeColor ?? s.fg, (eyeColor) => setStyle({ eyeColor }), 'c-eye'),
        s.eyeColor
          ? el(
              'button',
              { type: 'button', class: 'btn btn-small', onclick: () => setStyle({ eyeColor: null }, true) },
              t('style.eyeColor.same'),
            )
          : null,
      ),
      el(
        'div',
        { class: 'color-row' },
        el(
          'label',
          { class: 'range-field', for: 'r-margin' },
          el('span', {}, `${t('style.margin')}: ${s.margin}`),
          el('input', {
            type: 'range',
            id: 'r-margin',
            min: 0,
            max: 8,
            step: 1,
            value: String(s.margin),
            oninput: (e: Event) => setStyle({ margin: Number((e.target as HTMLInputElement).value) }, false),
          }),
        ),
      ),
      chipRow(
        'ecc',
        'style.ecc',
        ['auto', 'L', 'M', 'Q', 'H'] as const,
        s.ecc,
        (o) => `ecc.${o}`,
        (ecc) => setStyle({ ecc }),
      ),
    );

    // Logo
    const fileInput = el('input', {
      type: 'file',
      id: 'logo-file',
      accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
      class: 'sr-only',
      onchange: (e: Event) => void onLogoPicked(e),
    });
    logoNote = el('p', { class: 'field-note', 'aria-live': 'polite' });
    put(
      styleHost,
      el(
        'div',
        { class: 'field' },
        el('span', { class: 'label' }, t('style.logo')),
        el(
          'div',
          { class: 'logo-row' },
          fileInput,
          el(
            'label',
            { for: 'logo-file', class: 'btn btn-small' },
            s.logo ? t('style.logo.replace') : t('style.logo.add'),
          ),
          s.logo
            ? el(
                'button',
                { type: 'button', class: 'btn btn-small', onclick: () => setStyle({ logo: null }, true) },
                t('style.logo.remove'),
              )
            : null,
        ),
        s.logo
          ? el(
              'label',
              { class: 'range-field', for: 'r-logo' },
              el('span', {}, t('style.logo.size')),
              el('input', {
                type: 'range',
                id: 'r-logo',
                min: 0.1,
                max: MAX_LOGO_RATIO.H,
                step: 0.01,
                value: String(s.logo.ratio),
                oninput: (e: Event) =>
                  setStyle({ logo: { ...s.logo!, ratio: Number((e.target as HTMLInputElement).value) } }),
              }),
            )
          : null,
        logoNote,
      ),
    );

    renderSavedStyles();
  }

  async function onLogoPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const href = await readLogo(file);
      setStyle({ logo: { href, ratio: state.style.logo?.ratio ?? 0.22 } }, true);
    } catch {
      notify(t('style.logo.error'), 'error');
    }
  }

  const savedHost = el('div', { class: 'saved' });
  function renderSavedStyles(): void {
    clear(savedHost);
    const list = loadSavedStyles();
    const nameInput = el('input', {
      type: 'text',
      id: 'style-name',
      maxlength: 40,
      placeholder: t('style.save.default'),
      'aria-label': t('style.save.name'),
    });
    const importInput = el('input', {
      type: 'file',
      id: 'style-import',
      accept: 'application/json,.json',
      class: 'sr-only',
      onchange: (e: Event) => void onImportStyle(e),
    });
    savedHost.append(
      el('h3', { class: 'subtitle' }, t('style.saved')),
      el(
        'div',
        { class: 'logo-row' },
        nameInput,
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-small',
            onclick: () => {
              const next: SavedStyle[] = [
                {
                  id: crypto.randomUUID(),
                  name: nameInput.value.trim() || t('style.save.default'),
                  style: { ...state.style },
                },
                ...loadSavedStyles(),
              ];
              saveStyles(next);
              renderSavedStyles();
            },
          },
          t('style.save'),
        ),
      ),
    );
    if (list.length > 0) {
      const ul = el('ul', { class: 'saved-list' });
      for (const item of list) {
        ul.append(
          el(
            'li',
            {},
            el('span', {}, item.name),
            el(
              'button',
              {
                type: 'button',
                class: 'btn btn-small',
                onclick: () => {
                  state.style = { ...item.style };
                  renderStyle();
                  refresh();
                },
              },
              t('style.load'),
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'btn btn-small',
                onclick: () => {
                  saveStyles(loadSavedStyles().filter((x) => x.id !== item.id));
                  renderSavedStyles();
                },
              },
              t('style.delete'),
            ),
          ),
        );
      }
      savedHost.append(ul);
    }
    savedHost.append(
      el(
        'div',
        { class: 'logo-row' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-small',
            onclick: () =>
              saveBlob(new Blob([exportStyleJson(state.style)], { type: 'application/json' }), 'codifyqr-style.json'),
          },
          t('style.export'),
        ),
        importInput,
        el('label', { for: 'style-import', class: 'btn btn-small' }, t('style.import')),
        el('button', { type: 'button', class: 'btn btn-small', onclick: () => void copyStyleLink() }, t('style.link')),
      ),
    );
    styleHost.append(savedHost);
  }

  async function onImportStyle(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || file.size > MAX_LOGO_BYTES * 2) return;
    const style = importStyleJson(await file.text());
    if (!style) return notify(t('style.import.error'), 'error');
    state.style = style;
    renderStyle();
    refresh();
  }

  async function copyStyleLink(): Promise<void> {
    const url = `${location.origin}${location.pathname}${styleToHash(state.style)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(t('style.link.copied'));
    } catch {
      notify(url);
    }
  }

  // ---------- Frame panel ----------
  const frameFields = el('div', { class: 'fields' });
  function frameDefaults(frame: FrameId): FrameText {
    const base = {
      headline: has(`tpl.${frame}.headline`) ? t(`tpl.${frame}.headline`) : '',
      subline: has(`tpl.${frame}.subline`) ? t(`tpl.${frame}.subline`) : '',
      footnote: has(`tpl.${frame}.footnote`) ? t(`tpl.${frame}.footnote`) : '',
    };
    if (frame === 'pix' && state.kind === 'pix') {
      const v = valuesFor('pix');
      if ((v.name ?? '').trim()) base.subline = v.name!.trim();
      if ((v.amount ?? '').trim()) base.footnote = `R$ ${v.amount!.trim().replace(/^R\$\s*/i, '')}`;
    }
    if (frame === 'wifi' && state.kind === 'wifi' && (valuesFor('wifi').ssid ?? '').trim())
      base.footnote = valuesFor('wifi').ssid!.trim();
    return base;
  }
  function frameTexts(frame: FrameId): FrameText {
    const defaults = frameDefaults(frame);
    return {
      headline: state.frameText.headline ?? defaults.headline,
      subline: state.frameText.subline ?? defaults.subline,
      footnote: state.frameText.footnote ?? defaults.footnote,
    };
  }

  function renderFrame(): void {
    clear(frameHost);
    clear(frameFields);
    frameHost.append(
      chipRow(
        'frame',
        'frame.title',
        FRAME_IDS,
        state.frame,
        (o) => `frame.${o}`,
        (frame) => {
          state.frame = frame;
          state.frameText = { headline: null, subline: null, footnote: null };
          renderFrame();
          refresh();
        },
      ),
    );
    if (state.frame !== 'none') {
      const texts = frameTexts(state.frame);
      for (const key of ['headline', 'subline', 'footnote'] as const) {
        frameFields.append(
          el(
            'div',
            { class: 'field' },
            el('label', { for: `frame-${key}` }, t(`frame.${key}`)),
            el('input', {
              type: 'text',
              id: `frame-${key}`,
              maxlength: 60,
              value: texts[key],
              oninput: (e: Event) => {
                state.frameText[key] = (e.target as HTMLInputElement).value;
                refresh();
              },
            }),
          ),
        );
      }
      frameHost.append(frameFields);
    }
  }

  // ---------- Pipeline ----------
  function showEmpty(message?: string): void {
    previewImg.hidden = true;
    emptyText.hidden = !!message;
    errorText.hidden = !message;
    errorText.textContent = message ?? '';
    infoLine.textContent = '';
    document.dispatchEvent(new CustomEvent('codifyqr:info', { detail: null }));
    current = null;
    verifyToken++;
    lastVerify = null;
    suggestion = null;
    renderVerify('empty');
  }

  function refresh(): void {
    const spec = PAYLOADS[state.kind];
    const result = spec.build(valuesFor(state.kind));
    lastBuild = result;
    renderErrors(result);
    if (!result.ok) {
      showEmpty();
      return;
    }

    if (textNote) textNote.textContent = result.notes.includes('autoHttps') ? t('hint.text.https') : '';

    let plan: QrPlan;
    try {
      plan = planQr(result.text, state.style);
    } catch (error) {
      showEmpty(error instanceof DataTooLongError ? t('err.tooLong') : t('err.render'));
      return;
    }

    const qrSvg = renderQrSvg(plan, { title: t('stage.alt') });
    const composition = composeFrame(state.frame, qrSvg, frameTexts(state.frame), state.style);
    const fileSvg =
      state.frame === 'none' ? renderQrSvg(plan, { px: state.pngSize, title: 'QR code' }) : composition.svg;
    current = { text: result.text, plan, composition, fileSvg };

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = svgToBlobUrl(composition.svg);
    previewImg.src = previewUrl;
    previewImg.width = composition.width > 1 ? composition.width : 320;
    previewImg.height = composition.width > 1 ? composition.height : 320;
    previewImg.hidden = false;
    emptyText.hidden = true;
    errorText.hidden = true;
    document.dispatchEvent(
      new CustomEvent('codifyqr:info', {
        detail: { version: plan.matrix.version, size: plan.matrix.size, ecc: plan.matrix.ecc },
      }),
    );
    infoLine.textContent = t('stage.info', {
      version: plan.matrix.version,
      size: plan.matrix.size,
      ecc: plan.matrix.ecc,
    });
    if (logoNote) logoNote.textContent = plan.logoClamped ? t('style.logo.clamped') : '';
    scheduleVerify();
  }

  const scheduleVerify = debounce(() => void runVerify(), 350);

  async function runVerify(): Promise<void> {
    if (!current) return;
    const token = ++verifyToken;
    const { text } = current;
    const style = state.style;
    renderVerify('checking');
    try {
      const result = await verifyQr(text, style);
      if (token !== verifyToken) return;
      lastVerify = result;
      suggestion = result.state === 'ok' ? null : await suggestFix(text, style, result);
      if (token !== verifyToken) return;
      renderVerify(result.state);
    } catch (error) {
      console.warn('Read check failed', error);
      if (token === verifyToken) renderVerify('empty');
    }
  }

  function renderVerify(kind: 'empty' | 'checking' | 'ok' | 'risk' | 'fail'): void {
    verifyBox.dataset.state = kind;
    document.dispatchEvent(new CustomEvent('codifyqr:status', { detail: { state: kind } }));
    verifyBox.setAttribute('aria-busy', String(kind === 'checking'));
    clear(verifyCauses);
    fixButton.hidden = true;
    if (kind === 'empty' || kind === 'checking') {
      mascotImg.src = MASCOTS.ok;
      mascotImg.alt = '';
      verifyTitle.textContent = kind === 'empty' ? t('verify.empty') : t('verify.checking');
      verifyDetail.textContent = '';
      return;
    }
    mascotImg.src = MASCOTS[kind];
    mascotImg.alt = t(`verify.mascot.${kind}`);
    verifyTitle.textContent = t(`verify.${kind}`);
    verifyDetail.textContent = t(`verify.${kind}Detail`);
    for (const cause of lastVerify?.causes ?? []) verifyCauses.append(el('li', {}, t(`cause.${cause.id}`)));
    if (kind !== 'ok') {
      if (suggestion) {
        const fixes = suggestion.fixes.map((f) => t(`fix.${f}`)).join(', ');
        fixButton.textContent = `${t('fix.apply')}: ${fixes}`;
        fixButton.title = t('fix.suggest', { fixes });
        fixButton.hidden = false;
        fixButton.onclick = () => {
          if (!suggestion) return;
          state.style = { ...suggestion.style };
          renderStyle();
          refresh();
        };
      } else if (kind === 'fail') verifyCauses.append(el('li', {}, t('fix.none')));
    }
  }

  // ---------- Export ----------
  function requireCurrent(): Current | null {
    if (!current) {
      notify(t('export.needContent'), 'error');
      for (const input of inputNodes.values())
        if ((input as HTMLInputElement).value === '' && input.hasAttribute('id')) {
          (input as HTMLInputElement).focus();
          break;
        }
      for (const f of PAYLOADS[state.kind].fields) state.touched.add(`${state.kind}.${f.name}`);
      renderErrors(lastBuild);
    }
    return current;
  }

  function pngDimensions(c: Current, width: number): [number, number] {
    const height = c.composition.width > 1 ? Math.round((width * c.composition.height) / c.composition.width) : width;
    return [width, height];
  }

  async function exportPng(): Promise<void> {
    const c = requireCurrent();
    if (!c) return;
    const [w, h] = pngDimensions(c, state.pngSize);
    if (w > MAX_CANVAS_EDGE || h > MAX_CANVAS_EDGE) return notify(t('export.tooBig'), 'error');
    try {
      const svg = state.frame === 'none' ? renderQrSvg(c.plan, { px: w }) : c.composition.svg;
      saveBlob(await svgToPng(svg, w, h), fileName(state.kind, 'png'));
      notify(t('export.done'));
    } catch {
      notify(t('export.failed'), 'error');
    }
  }

  function exportSvg(): void {
    const c = requireCurrent();
    if (!c) return;
    const svg =
      state.frame === 'none' ? renderQrSvg(c.plan, { px: state.pngSize, title: 'QR code' }) : c.composition.svg;
    saveBlob(
      new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' }),
      fileName(state.kind, 'svg'),
    );
    notify(t('export.done'));
  }

  async function pngBlobForShare(): Promise<Blob | null> {
    const c = requireCurrent();
    if (!c) return null;
    const [w, h] = pngDimensions(c, 1024);
    return svgToPng(state.frame === 'none' ? renderQrSvg(c.plan, { px: w }) : c.composition.svg, w, h);
  }

  async function copyImage(): Promise<void> {
    if (!requireCurrent()) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlobForShare().then((b) => b ?? Promise.reject(new Error('empty'))) }),
      ]);
      notify(t('export.copied'));
    } catch {
      notify(t('export.copyFailed'), 'error');
    }
  }

  async function shareImage(): Promise<void> {
    const blob = await pngBlobForShare();
    if (!blob) return;
    const file = new File([blob], fileName(state.kind, 'png'), { type: 'image/png' });
    try {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') notify(t('export.failed'), 'error');
    }
  }

  // ---------- PDF dialog ----------
  const pdfDialog = el('dialog', { class: 'dialog', 'aria-labelledby': 'pdf-title' });
  function openPdfDialog(): void {
    const c = requireCurrent();
    if (!c) return;
    clear(pdfDialog);
    const framed = c.composition.mm !== null;
    const papers = ['natural', 'A4', 'A5', 'A6'] as const;
    let paper: (typeof papers)[number] = 'natural';
    let qrCm = 5;
    const moduleInfo = el('p', { class: 'field-note', 'aria-live': 'polite' });
    const warn = el('p', { class: 'field-error', hidden: true });
    const totalModules = c.plan.matrix.size + c.plan.style.margin * 2;
    const update = () => {
      const qrMm = framed ? (c.composition.qr / c.composition.width) * c.composition.mm!.width : qrCm * 10;
      const mm = qrMm / totalModules;
      moduleInfo.textContent = t('pdf.module', { mm: mm.toFixed(2) });
      warn.hidden = mm >= 0.4;
      warn.textContent = mm >= 0.4 ? '' : t('pdf.moduleWarn');
    };
    const paperSelect = el(
      'select',
      { id: 'pdf-paper', onchange: (e: Event) => (paper = (e.target as HTMLSelectElement).value as typeof paper) },
      ...papers.map((p) => el('option', { value: p }, p === 'natural' ? t('pdf.natural') : p)),
    );
    const sizeInput = el('input', {
      type: 'number',
      id: 'pdf-qr',
      min: 1,
      max: 50,
      step: 0.5,
      value: '5',
      oninput: (e: Event) => {
        qrCm = Math.max(1, Number((e.target as HTMLInputElement).value) || 5);
        update();
      },
    });
    const create = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        onclick: async () => {
          create.disabled = true;
          try {
            await exportPdf(c, paper, qrCm);
            pdfDialog.close();
          } catch {
            notify(t('export.failed'), 'error');
          } finally {
            create.disabled = false;
          }
        },
      },
      t('pdf.create'),
    );
    put(
      pdfDialog,
      el('h2', { id: 'pdf-title', class: 'section-title' }, t('pdf.title')),
      el('div', { class: 'field' }, el('label', { for: 'pdf-paper' }, t('pdf.paper')), paperSelect),
      framed ? null : el('div', { class: 'field' }, el('label', { for: 'pdf-qr' }, t('pdf.qrsize')), sizeInput),
      moduleInfo,
      warn,
      el('p', { class: 'hint' }, t('pdf.note')),
      el(
        'div',
        { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => pdfDialog.close() }, t('pdf.cancel')),
        create,
      ),
    );
    update();
    pdfDialog.showModal();
  }

  async function exportPdf(c: Current, paper: 'natural' | 'A4' | 'A5' | 'A6', qrCm: number): Promise<void> {
    const { buildPdf, PAPERS, pdfDpi } = await import('../export/pdf');
    const framed = c.composition.mm !== null;
    const contentMm = framed ? c.composition.mm! : { width: qrCm * 10, height: qrCm * 10 };
    let pageMm = framed ? { ...contentMm } : { width: contentMm.width + 20, height: contentMm.height + 20 };
    if (paper !== 'natural') {
      const p = PAPERS.find((x) => x.id === paper)!;
      pageMm = { width: p.widthMm, height: p.heightMm };
    }
    const fit = Math.min(
      1,
      (pageMm.width - (paper === 'natural' ? 0 : 20)) / contentMm.width,
      (pageMm.height - (paper === 'natural' ? 0 : 20)) / contentMm.height,
    );
    const w = contentMm.width * fit;
    const h = contentMm.height * fit;
    const x = (pageMm.width - w) / 2;
    const y = (pageMm.height - h) / 2;

    const inner = framed ? c.composition.svg : renderQrSvg(c.plan);
    const page = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageMm.width * 10} ${pageMm.height * 10}"><rect width="${pageMm.width * 10}" height="${pageMm.height * 10}" fill="#fff"/>${embedSvg(inner, x * 10, y * 10, w * 10, h * 10)}</svg>`;

    const dpi = pdfDpi(pageMm.width, pageMm.height, typeof CompressionStream !== 'undefined');
    const pxW = Math.round((pageMm.width / 25.4) * dpi);
    const pxH = Math.round((pageMm.height / 25.4) * dpi);
    const canvas = await svgToCanvas(page, pxW, pxH);
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pxW, pxH);
    const image = ctx.getImageData(0, 0, pxW, pxH);
    const blob = await buildPdf(
      { width: pxW, height: pxH, data: image.data, widthMm: pageMm.width, heightMm: pageMm.height },
      'CodifyQR',
    );
    saveBlob(blob, fileName(state.kind, 'pdf'));
    notify(t('export.done'));
  }

  // ---------- Layout: type grid, tabs for content, style and frame, and a bottom bar on narrow screens ----------
  type Panel = 'type' | 'content' | 'style' | 'frame' | 'export';
  const SUBS = ['content', 'style', 'frame'] as const;
  let panel: Panel = 'content';
  let sub: (typeof SUBS)[number] = 'content';
  const PANEL_ICON: Record<Panel, IconName> = {
    type: 'create',
    content: 'content',
    style: 'style',
    frame: 'frame',
    export: 'download',
  };
  const panelLabel = (p: Panel): string =>
    p === 'type'
      ? t('panel.type')
      : p === 'content'
        ? t('panel.content')
        : p === 'style'
          ? t('style.title')
          : p === 'frame'
            ? t('frame.title')
            : t('export.title');

  function setPanel(next: Panel): void {
    panel = next;
    if ((SUBS as readonly string[]).includes(next)) sub = next as (typeof SUBS)[number];
    root.dataset.panel = panel;
    root.dataset.sub = sub;
    for (const tab of root.querySelectorAll<HTMLElement>('[data-sub-tab]')) {
      const on = tab.dataset.subTab === sub;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const button of root.querySelectorAll<HTMLElement>('[data-nav]')) {
      if (button.dataset.nav === panel) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  const subTabs = el('div', { class: 'subtabs', role: 'tablist', 'aria-label': t('mode.create') });
  for (const name of SUBS) {
    subTabs.append(
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'subtab',
          'data-sub-tab': name,
          onclick: () => setPanel(name),
          onkeydown: (e: KeyboardEvent) => {
            const i = SUBS.indexOf(name);
            const next =
              e.key === 'ArrowRight'
                ? SUBS[(i + 1) % SUBS.length]
                : e.key === 'ArrowLeft'
                  ? SUBS[(i + SUBS.length - 1) % SUBS.length]
                  : null;
            if (next) {
              e.preventDefault();
              setPanel(next);
              root.querySelector<HTMLElement>(`[data-sub-tab="${next}"]`)?.focus();
            }
          },
        },
        icon(PANEL_ICON[name]),
        el('span', {}, panelLabel(name)),
      ),
    );
  }

  const navBar = el('nav', { class: 'panel-nav', 'aria-label': t('mode.create') });
  for (const name of ['type', 'content', 'style', 'frame', 'export'] as const) {
    navBar.append(
      el(
        'button',
        { type: 'button', class: 'nav-btn', 'data-nav': name, onclick: () => setPanel(name) },
        icon(PANEL_ICON[name]),
        el('span', {}, panelLabel(name)),
      ),
    );
  }

  const controls = el(
    'section',
    { class: 'col col-controls', id: 'editor' },
    el('h2', { class: 'sr-only' }, t('mode.create')),
    el('div', { class: 'panel-type' }, kindGroup),
    subTabs,
    el(
      'div',
      { class: 'subpanels' },
      el('div', { class: 'subpanel', role: 'tabpanel', 'data-sub-panel': 'content' }, fieldsHost),
      el('div', { class: 'subpanel', role: 'tabpanel', 'data-sub-panel': 'style' }, styleHost),
      el('div', { class: 'subpanel', role: 'tabpanel', 'data-sub-panel': 'frame' }, frameHost),
    ),
  );
  root.append(controls, stage, side, navBar, pdfDialog);

  // ---------- Keyboard shortcuts and status for the page chrome ----------
  const keys = new AbortController();
  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!root.offsetParent || document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement;
      const typing = target.matches('input, textarea, select, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        void exportPng();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPanel('content');
        root.querySelector<HTMLElement>('.fields input, .fields textarea')?.focus();
      } else if (!typing && !mod && !e.altKey && singleKeys()) {
        const index = '1234567890'.indexOf(e.key);
        const kind = index >= 0 ? PAYLOAD_KINDS[index] : undefined;
        const key = e.key.toLowerCase();
        if (kind) {
          const radio = root.querySelector<HTMLInputElement>(`#kind-${kind}`);
          if (radio) {
            radio.checked = true;
            selectKind(kind);
          }
        } else if (key === 'c') setPanel('content');
        else if (key === 's') setPanel('style');
        else if (key === 'f') setPanel('frame');
        else if (key === 'x') {
          if (!fixButton.hidden) fixButton.click();
        } else if (key === 'p') void exportPng();
        else if (key === 'v') exportSvg();
        else if (key === 'd') openPdfDialog();
        else if (key === 'y') void copyImage();
      }
    },
    { signal: keys.signal },
  );
  Object.assign(root, { dispose: () => keys.abort() });

  renderKinds();
  renderFields();
  renderStyle();
  renderFrame();
  renderVerify('empty');
  setPanel('content');
  refresh();
  return root;
}

/** Reads a logo file into a small data URL. Rasters are resized to 256 px and keep their transparency. */
async function readLogo(file: File): Promise<string> {
  if (file.size > MAX_LOGO_BYTES) throw new Error('too large');
  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    if (!/<svg[\s>]/i.test(text)) throw new Error('not svg');
    return `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(text)))}`;
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('unsupported');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
