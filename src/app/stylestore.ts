import { parseHex } from '../qr/color';
import { ECC_LEVELS } from '../qr/encoder';
import { DEFAULT_STYLE, EYE_BALL_SHAPES, EYE_FRAME_SHAPES, MODULE_SHAPES, type QrStyle } from '../qr/style';
import { readPref, writePref } from './dom';

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const color = (value: unknown, fallback: string | null): string | null =>
  typeof value === 'string' && parseHex(value) ? value.toLowerCase() : fallback;

const num = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Turns untrusted input (URL hash, imported file, storage) into a valid style. */
export function sanitizeStyle(input: unknown): QrStyle {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const logo = raw.logo as Record<string, unknown> | null | undefined;
  const hasLogo =
    !!logo && typeof logo.href === 'string' && logo.href.startsWith('data:image/') && logo.href.length < 3_000_000;
  return {
    shape: oneOf(MODULE_SHAPES, raw.shape, DEFAULT_STYLE.shape),
    eyeFrame: oneOf(EYE_FRAME_SHAPES, raw.eyeFrame, DEFAULT_STYLE.eyeFrame),
    eyeBall: oneOf(EYE_BALL_SHAPES, raw.eyeBall, DEFAULT_STYLE.eyeBall),
    fg: color(raw.fg, DEFAULT_STYLE.fg) as string,
    fg2: color(raw.fg2, null),
    gradient: oneOf(['linear', 'radial'] as const, raw.gradient, 'linear'),
    gradientAngle: num(raw.gradientAngle, 0, 360, DEFAULT_STYLE.gradientAngle),
    eyeColor: color(raw.eyeColor, null),
    bg: raw.bg === null ? null : color(raw.bg, DEFAULT_STYLE.bg),
    margin: Math.round(num(raw.margin, 0, 8, DEFAULT_STYLE.margin)),
    ecc: oneOf(['auto', ...ECC_LEVELS] as const, raw.ecc, 'auto'),
    logo: hasLogo ? { href: (logo as { href: string }).href, ratio: num(logo.ratio, 0.1, 0.32, 0.22) } : null,
  };
}

/** Encodes UTF-8 text to base64 in chunks so large SVG logos never overflow the call stack. */
export function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const toBase64Url = (s: string) => toBase64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** The link carries the look only. The content and the logo never go in the URL. */
export function styleToHash(style: QrStyle): string {
  return `#s=${toBase64Url(JSON.stringify({ ...style, logo: null }))}`;
}

export function styleFromHash(hash: string): QrStyle | null {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    return sanitizeStyle(JSON.parse(fromBase64Url(m[1]!)));
  } catch {
    return null;
  }
}

export interface SavedStyle {
  id: string;
  name: string;
  style: QrStyle;
}

const KEY = 'codifyqr.styles';

export function loadSavedStyles(): SavedStyle[] {
  const raw = readPref(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (x): x is { id: string; name: string; style: unknown } =>
          typeof x?.id === 'string' && typeof x?.name === 'string',
      )
      .map((x) => ({ id: x.id, name: x.name.slice(0, 40), style: sanitizeStyle(x.style) }));
  } catch {
    return [];
  }
}

export function saveStyles(list: SavedStyle[]): void {
  writePref(KEY, JSON.stringify(list.slice(0, 30)));
}

export const exportStyleJson = (style: QrStyle): string => JSON.stringify({ codifyqr: 1, style }, null, 2);

export function importStyleJson(text: string): QrStyle | null {
  try {
    const data = JSON.parse(text) as { codifyqr?: number; style?: unknown };
    return data && data.codifyqr === 1 ? sanitizeStyle(data.style) : null;
  } catch {
    return null;
  }
}

export const COLOR_PRESETS: readonly { id: string; fg: string; fg2: string | null; bg: string | null }[] = [
  { id: 'ink', fg: '#111111', fg2: null, bg: '#ffffff' },
  { id: 'press', fg: '#C8231A', fg2: null, bg: '#F5F4EF' },
  { id: 'ocean', fg: '#0b3c8a', fg2: '#0e7490', bg: '#ffffff' },
  { id: 'clay', fg: '#7c2d12', fg2: '#b45309', bg: '#fff7ed' },
  { id: 'violet', fg: '#4c1d95', fg2: '#be185d', bg: '#ffffff' },
];
