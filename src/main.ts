import { clear, el } from './app/dom';
import { detectLang, getLang, LANGS, type Lang, setLang, t } from './app/i18n';
import { state } from './app/state';
import { createStudio } from './app/studio';
import { styleFromHash } from './app/stylestore';
import { applyTheme, currentTheme, nextTheme, type ThemeChoice } from './app/theme';
import wordmark from './assets/wordmark.svg?raw';
import './styles/main.css';

type Mode = 'create' | 'batch' | 'scan';
const MODES: readonly Mode[] = ['create', 'batch', 'scan'];

let mode: Mode = 'create';
let toastHost: HTMLElement;

function notify(message: string, kind: 'info' | 'error' = 'info'): void {
  const toast = el('p', { class: `toast toast-${kind}` }, message);
  toastHost.append(toast);
  setTimeout(() => toast.remove(), kind === 'error' ? 6000 : 3500);
}

const ICONS: Record<ThemeChoice, string> = {
  auto: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light:
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="currentColor"/></svg>',
};

const panels: Partial<Record<Mode, HTMLElement>> = {};
let panelHost: HTMLElement;
let tabs: HTMLElement;

async function showMode(next: Mode): Promise<void> {
  mode = next;
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

function render(): void {
  const app = document.getElementById('app')!;
  clear(app);
  panels.batch = undefined;
  panels.scan = undefined;
  panels.create = undefined;

  const themeChoice = currentTheme();
  const themeBtn = el('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': t(`theme.${themeChoice}`),
    title: t(`theme.${themeChoice}`),
  });
  themeBtn.innerHTML = ICONS[themeChoice];
  themeBtn.addEventListener('click', () => {
    applyTheme(nextTheme(themeChoice));
    render();
  });

  const langSelect = el(
    'select',
    {
      class: 'lang-select',
      'aria-label': t('lang.label'),
      onchange: async (e: Event) => {
        await setLang((e.target as HTMLSelectElement).value as Lang);
        render();
      },
    },
    ...LANGS.map((l) => el('option', { value: l, selected: l === getLang() }, t(`lang.${l}`))),
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
        t(`mode.${m}`),
      ),
    );
  }

  const brand = el('a', { class: 'brand', href: './', 'aria-label': t('app.name') });
  brand.innerHTML = wordmark;
  brand.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  brand.querySelector('svg')?.removeAttribute('width');
  brand.querySelector('svg')?.removeAttribute('height');

  panelHost = el('div', { class: 'panels', role: 'tabpanel' });
  panels.create = createStudio(notify);
  panelHost.append(panels.create);
  toastHost = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });

  app.append(
    el('a', { class: 'skip', href: '#editor' }, t('app.skip')),
    el('header', { class: 'topbar' }, brand, tabs, el('div', { class: 'topbar-actions' }, langSelect, themeBtn)),
    el(
      'main',
      { class: 'page' },
      el('section', { class: 'hero' }, el('h1', {}, t('app.tagline')), el('p', { class: 'lead' }, t('app.lead'))),
      panelHost,
    ),
    el(
      'footer',
      { class: 'footer' },
      el('p', {}, t('footer.privacy')),
      el(
        'p',
        {},
        t('footer.made'),
        ' ',
        el('a', { href: 'https://github.com/lucaswotta/codifyqr', rel: 'noopener noreferrer' }, t('footer.source')),
        ' · ',
        el(
          'a',
          { href: 'https://github.com/lucaswotta/codifyqr/blob/main/LICENSE', rel: 'noopener noreferrer' },
          t('footer.license'),
        ),
      ),
    ),
    toastHost,
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
