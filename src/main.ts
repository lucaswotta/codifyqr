import { clear, el } from './app/dom';
import { detectLang, getLang, LANGS, type Lang, setLang, t } from './app/i18n';
import { icon } from './app/icons';
import { setSingleKeys, singleKeys } from './app/prefs';
import { state } from './app/state';
import { createStudio } from './app/studio';
import { styleFromHash } from './app/stylestore';
import { applyTheme, currentTheme, nextTheme } from './app/theme';
import wordmark from './assets/wordmark.svg?raw';
import './styles/main.css';

type Mode = 'create' | 'batch' | 'scan';
const MODES: readonly Mode[] = ['create', 'batch', 'scan'];
const LANG_CODE: Record<Lang, string> = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };

let mode: Mode = 'create';
let toastHost: HTMLElement;
let disposeStudio: (() => void) | null = null;

function notify(message: string, kind: 'info' | 'error' = 'info'): void {
  const toast = el('p', { class: `toast toast-${kind}` }, message);
  toastHost.append(toast);
  setTimeout(() => toast.remove(), kind === 'error' ? 6000 : 3500);
}

const panels: Partial<Record<Mode, HTMLElement>> = {};
let panelHost: HTMLElement;
let tabs: HTMLElement;
let cleanups: (() => void)[] = [];

async function showMode(next: Mode): Promise<void> {
  mode = next;
  document.getElementById('app')?.setAttribute('data-mode', mode);
  for (const m of MODES) {
    const tab = tabs.querySelector<HTMLElement>(`[data-mode="${m}"]`);
    tab?.setAttribute('aria-selected', String(m === mode));
    tab?.setAttribute('tabindex', m === mode ? '0' : '-1');
  }
  if (!panels[mode]) {
    if (mode === 'batch') panels.batch = (await import('./app/batch')).createBatch(notify);
    else if (mode === 'scan') panels.scan = (await import('./app/reader')).createReader(notify);
    if (panels[mode]) panelHost.append(panels[mode]!);
  }
  for (const m of MODES) if (panels[m]) panels[m]!.hidden = m !== mode;
}

function languageMenu(): HTMLElement {
  const button = el(
    'button',
    {
      type: 'button',
      class: 'menu-btn',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'aria-label': `${t('lang.label')}: ${LANG_CODE[getLang()]}`,
      title: t('lang.label'),
    },
    icon('globe'),
    el('span', { class: 'menu-code' }, LANG_CODE[getLang()]),
    icon('chevron'),
  );
  const menu = el('div', { class: 'menu', role: 'menu', 'aria-label': t('lang.label'), hidden: true });
  for (const l of LANGS) {
    menu.append(
      el(
        'button',
        {
          type: 'button',
          role: 'menuitemradio',
          class: 'menu-item',
          'aria-checked': String(l === getLang()),
          lang: l,
          onclick: async () => {
            await setLang(l);
            render();
          },
        },
        el('span', { class: 'menu-code' }, LANG_CODE[l]),
        el('span', {}, t(`lang.${l}`)),
      ),
    );
  }
  const wrap = el('div', { class: 'menu-wrap' }, button, menu);
  const close = (focus = false) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  };
  button.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll<HTMLElement>('.menu-item')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') close(true);
    else if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i + items.length - 1) % items.length]?.focus();
    else return;
    e.preventDefault();
  });
  const outside = (e: Event) => {
    if (!wrap.contains(e.target as Node)) close();
  };
  document.addEventListener('pointerdown', outside);
  cleanups.push(() => document.removeEventListener('pointerdown', outside));
  return wrap;
}

function dialogHead(title: string, id: string, dialog: () => HTMLDialogElement): HTMLElement {
  return el(
    'div',
    { class: 'dialog-head' },
    el('h2', { id, class: 'section-title' }, title),
    el(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        'aria-label': t('help.close'),
        title: t('help.close'),
        onclick: () => dialog().close(),
      },
      icon('close'),
    ),
  );
}

const kbds = (keys: string[]) => keys.map((k) => el('kbd', {}, k));

function shortcutsDialog(): HTMLDialogElement {
  const groups: [string, [string[], string][]][] = [
    [
      t('shortcuts.g.editor'),
      [
        [['1 - 0'], t('shortcuts.kind')],
        [['C', 'S', 'F'], t('shortcuts.panels')],
        [['Ctrl', 'K'], t('shortcuts.focus')],
        [['X'], t('shortcuts.fix')],
      ],
    ],
    [
      t('shortcuts.g.export'),
      [
        [['Ctrl', 'Enter'], t('shortcuts.png')],
        [['P'], t('shortcuts.png')],
        [['V'], t('shortcuts.svg')],
        [['D'], t('shortcuts.pdf')],
        [['Y'], t('shortcuts.copy')],
      ],
    ],
    [
      t('shortcuts.g.app'),
      [
        [['[', ']'], t('shortcuts.tools')],
        [['T'], t('shortcuts.theme')],
        [['L'], t('shortcuts.lang')],
        [['H'], t('shortcuts.helpkey')],
        [['?'], t('shortcuts.list')],
        [['Esc'], t('shortcuts.esc')],
      ],
    ],
  ];
  const single = el('input', {
    type: 'checkbox',
    id: 'single-keys',
    checked: singleKeys(),
    onchange: (e: Event) => setSingleKeys((e.target as HTMLInputElement).checked),
  });
  const dialog: HTMLDialogElement = el(
    'dialog',
    { class: 'dialog dialog-wide', 'aria-labelledby': 'shortcuts-title' },
    dialogHead(t('shortcuts.title'), 'shortcuts-title', () => dialog),
    ...groups.map(([title, rows]) =>
      el(
        'section',
        { class: 'shortcut-group' },
        el('h3', { class: 'subtitle' }, title),
        el('dl', { class: 'shortcuts' }, ...rows.flatMap(([k, d]) => [el('dt', {}, ...kbds(k)), el('dd', {}, d)])),
      ),
    ),
    el(
      'div',
      { class: 'field' },
      el('label', { class: 'check', for: 'single-keys' }, single, t('shortcuts.single')),
      el('p', { class: 'field-note' }, t('shortcuts.singleHint')),
    ),
    el(
      'div',
      { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, t('help.close')),
    ),
  );
  return dialog;
}

function helpDialog(openShortcuts: () => void): HTMLDialogElement {
  const step = (n: number) => el('li', {}, el('strong', {}, t(`help.s${n}.t`)), el('span', {}, t(`help.s${n}.d`)));
  const dialog: HTMLDialogElement = el(
    'dialog',
    { class: 'dialog dialog-wide', 'aria-labelledby': 'help-title' },
    dialogHead(t('help.title'), 'help-title', () => dialog),
    el('p', { class: 'lead' }, t('help.intro')),
    el('ol', { class: 'help-steps' }, step(1), step(2), step(3), step(4), step(5)),
    el('h3', { class: 'subtitle' }, t('help.tips.title')),
    el('ul', { class: 'help-list' }, ...[1, 2, 3, 4].map((n) => el('li', {}, t(`help.tips.${n}`)))),
    el('h3', { class: 'subtitle' }, t('help.terms.title')),
    el(
      'ul',
      { class: 'help-list' },
      el('li', {}, t('help.term.ecc')),
      el('li', {}, t('help.term.version')),
      el('li', {}, t('help.term.static')),
    ),
    el('h3', { class: 'subtitle' }, t('help.pix.title')),
    el('p', {}, t('help.pix.d')),
    el(
      'div',
      { class: 'dialog-actions' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            dialog.close();
            openShortcuts();
          },
        },
        icon('keyboard'),
        el('span', {}, t('help.shortcuts')),
      ),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => dialog.close() }, t('help.close')),
    ),
  );
  return dialog;
}

function render(): void {
  const app = document.getElementById('app')!;
  for (const fn of cleanups) fn();
  cleanups = [];
  disposeStudio?.();
  clear(app);
  panels.batch = undefined;
  panels.scan = undefined;
  panels.create = undefined;

  const themeChoice = currentTheme();
  const themeBtn = el(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': t(`theme.${themeChoice}`), title: t(`theme.${themeChoice}`) },
    icon(themeChoice === 'auto' ? 'auto' : themeChoice === 'light' ? 'sun' : 'moon'),
  );
  themeBtn.addEventListener('click', () => {
    applyTheme(nextTheme(themeChoice));
    render();
  });

  const shortcuts = shortcutsDialog();
  const help = helpDialog(() => shortcuts.showModal());
  const shortcutsBtn = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn btn-shortcuts',
      'aria-label': t('shortcuts.title'),
      title: t('shortcuts.title'),
      onclick: () => shortcuts.showModal(),
    },
    icon('keyboard'),
  );
  const helpBtn = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn help-btn',
      'aria-label': t('help.open'),
      title: t('help.open'),
      onclick: () => help.showModal(),
    },
    icon('help'),
    el('span', { class: 'help-label' }, t('help.open')),
  );

  tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': t('mode.label') });
  for (const m of MODES) {
    tabs.append(
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'tab',
          'data-mode': m,
          'aria-selected': String(m === mode),
          onclick: () => void showMode(m),
          onkeydown: (e: KeyboardEvent) => {
            const i = MODES.indexOf(m);
            const target =
              e.key === 'ArrowRight'
                ? MODES[(i + 1) % MODES.length]
                : e.key === 'ArrowLeft'
                  ? MODES[(i + MODES.length - 1) % MODES.length]
                  : null;
            if (target) {
              e.preventDefault();
              void showMode(target);
              tabs.querySelector<HTMLElement>(`[data-mode="${target}"]`)?.focus();
            }
          },
        },
        icon(m),
        el('span', {}, t(`mode.${m}`)),
      ),
    );
  }

  const brand = el('a', { class: 'brand', href: './', 'aria-label': t('app.name') });
  brand.innerHTML = wordmark;
  brand.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  brand.querySelector('svg')?.removeAttribute('width');
  brand.querySelector('svg')?.removeAttribute('height');

  const statusText = el('span', { class: 'status-text' });
  const statusLight = el(
    'span',
    { class: 'status-light', role: 'status', 'data-state': 'empty' },
    el('i', { class: 'status-dot' }),
    statusText,
  );
  const onStatus = (e: Event) => {
    const value = (e as CustomEvent<{ state: string }>).detail.state;
    statusLight.dataset.state = value;
    statusText.textContent =
      value === 'ok' || value === 'risk' || value === 'fail'
        ? t(`verify.${value}`)
        : value === 'checking'
          ? t('verify.checking')
          : '';
  };
  document.addEventListener('codifyqr:status', onStatus);
  cleanups.push(() => document.removeEventListener('codifyqr:status', onStatus));

  const infoText = el('span', { class: 'status-info' });
  const onInfo = (e: Event) => {
    const d = (e as CustomEvent<{ version: number; size: number; ecc: string } | null>).detail;
    infoText.textContent = d ? `QR v${d.version} · ${d.size}×${d.size} · ECC ${d.ecc}` : '';
  };
  document.addEventListener('codifyqr:info', onInfo);
  cleanups.push(() => document.removeEventListener('codifyqr:info', onInfo));

  const onKeys = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    const target = e.target as HTMLElement;
    const typing = target.matches('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter' && mode === 'batch') {
      e.preventDefault();
      document.querySelector<HTMLElement>('#batch .btn-primary')?.click();
      return;
    }
    if (typing || mod || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      shortcuts.showModal();
      return;
    }
    if (!singleKeys()) return;
    const key = e.key.toLowerCase();
    if (key === '[' || key === ']') {
      const step = key === ']' ? 1 : MODES.length - 1;
      const next = MODES[(MODES.indexOf(mode) + step) % MODES.length]!;
      void showMode(next);
    } else if (key === 't') {
      applyTheme(nextTheme(themeChoice));
      render();
    } else if (key === 'l') {
      void setLang(LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length]!).then(render);
    } else if (key === 'h') {
      help.showModal();
    }
  };
  document.addEventListener('keydown', onKeys);
  cleanups.push(() => document.removeEventListener('keydown', onKeys));

  panelHost = el('div', { class: 'panels' });
  const studio = createStudio(notify);
  panels.create = studio;
  disposeStudio = (studio as unknown as { dispose?: () => void }).dispose ?? null;
  panelHost.append(studio);
  toastHost = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });

  app.append(
    el('a', { class: 'skip', href: '#editor' }, t('app.skip')),
    el(
      'header',
      { class: 'topbar' },
      brand,
      tabs,
      el('div', { class: 'topbar-actions' }, statusLight, languageMenu(), helpBtn, shortcutsBtn, themeBtn),
    ),
    el('main', { class: 'page' }, el('h1', { class: 'sr-only' }, `${t('app.name')}: ${t('app.tagline')}`), panelHost),
    el(
      'footer',
      { class: 'statusbar' },
      el('span', { class: 'status-tagline' }, t('app.tagline')),
      el('span', { class: 'status-net' }, icon('check'), t('footer.nonet')),
      infoText,
      el(
        'span',
        { class: 'status-links' },
        el('a', { href: 'https://github.com/lucaswotta/codifyqr', rel: 'noopener noreferrer' }, t('footer.source')),
        el(
          'a',
          { href: 'https://github.com/lucaswotta/codifyqr/blob/main/LICENSE', rel: 'noopener noreferrer' },
          t('footer.license'),
        ),
      ),
    ),
    toastHost,
    shortcuts,
    help,
  );
  void showMode(mode);
}

let updateRequested = false;

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
    })
    .catch(() => {
      // Offline support is an extra; the app works without it.
    });
  // The first install also fires controllerchange (clients.claim). Reload only after the user asked for an update.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });
}

function showUpdate(worker: ServiceWorker): void {
  const banner = el(
    'div',
    { class: 'toast toast-info toast-action' },
    el('span', {}, t('pwa.update')),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        onclick: () => {
          updateRequested = true;
          worker.postMessage('SKIP_WAITING');
        },
      },
      t('pwa.reload'),
    ),
    el('button', { type: 'button', class: 'btn btn-small', onclick: () => banner.remove() }, t('pwa.dismiss')),
  );
  toastHost.append(banner);
}

async function boot(): Promise<void> {
  applyTheme(currentTheme());
  await setLang(detectLang());
  const shared = styleFromHash(location.hash);
  if (shared) state.style = shared;
  render();
  window.addEventListener('offline', () => notify(t('pwa.offline')));
  registerServiceWorker();
}

void boot();
