import { parseHex } from './color';
import { type Ecc, encodeText, type QrMatrix } from './encoder';
import { MAX_LOGO_RATIO, minEccForLogoRatio, type QrStyle } from './style';

/** A logo needs room: below this version the cleared square would be a handful of modules. */
const MIN_VERSION_WITH_LOGO = 5;
const SEAM = 0.015;

export interface QrPlan {
  matrix: QrMatrix;
  style: QrStyle;
  /** Side of the cleared square as a fraction of the code, after clamping to what the ecc level can recover. */
  logoRatio: number;
  logoClamped: boolean;
}

/** Picks the error correction level and encodes. Throws DataTooLongError when the text does not fit. */
export function planQr(text: string, style: QrStyle): QrPlan {
  let minEcc: Ecc = 'M';
  if (style.ecc !== 'auto') minEcc = style.ecc;
  else if (style.logo) minEcc = minEccForLogoRatio(style.logo.ratio);

  const matrix = encodeText(text, {
    ecc: minEcc,
    boostEcc: style.ecc === 'auto',
    minVersion: style.logo ? MIN_VERSION_WITH_LOGO : 1,
  });

  let logoRatio = 0;
  let logoClamped = false;
  if (style.logo) {
    logoRatio = Math.min(style.logo.ratio, MAX_LOGO_RATIO[matrix.ecc]);
    logoClamped = logoRatio < style.logo.ratio;
  }
  return { matrix, style, logoRatio, logoClamped };
}

interface Box {
  x: number;
  y: number;
  len: number;
}

/** Cleared square for the logo, aligned to the module grid and centered. */
function logoBox(size: number, ratio: number): Box | null {
  if (ratio <= 0) return null;
  let len = Math.round(ratio * size);
  if ((size - len) % 2 !== 0) len -= 1;
  len = Math.min(len, size - 16);
  if (len < 3) return null;
  const origin = (size - len) / 2;
  return { x: origin, y: origin, len };
}

const f = (n: number): string => String(Math.round(n * 1000) / 1000);

const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;

const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}z`;

const rect = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;

function cornerPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): string {
  let d = `M${f(x0 + tl)} ${f(y0)}H${f(x1 - tr)}`;
  if (tr) d += `A${f(tr)} ${f(tr)} 0 0 1 ${f(x1)} ${f(y0 + tr)}`;
  d += `V${f(y1 - br)}`;
  if (br) d += `A${f(br)} ${f(br)} 0 0 1 ${f(x1 - br)} ${f(y1)}`;
  d += `H${f(x0 + bl)}`;
  if (bl) d += `A${f(bl)} ${f(bl)} 0 0 1 ${f(x0)} ${f(y1 - bl)}`;
  d += `V${f(y0 + tl)}`;
  if (tl) d += `A${f(tl)} ${f(tl)} 0 0 1 ${f(x0 + tl)} ${f(y0)}`;
  return `${d}z`;
}

function safeColor(value: string | null, fallback: string): string {
  return value && parseHex(value) ? value : fallback;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface RenderOptions {
  /** Pixel width and height written on the root element. Omit to leave the SVG unsized. */
  px?: number;
  /** Prefix for ids, so several SVGs can live in one document. */
  idPrefix?: string;
  /** Accessible name. */
  title?: string;
}

export function renderQrSvg(plan: QrPlan, options: RenderOptions = {}): string {
  const { matrix, style } = plan;
  const { size } = matrix;
  const margin = Math.max(0, style.margin);
  const total = size + margin * 2;
  const id = options.idPrefix ?? 'q';
  const box = logoBox(size, plan.logoRatio);

  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const inLogo = (x: number, y: number) =>
    !!box && x >= box.x && x < box.x + box.len && y >= box.y && y < box.y + box.len;
  const dark = (x: number, y: number) => matrix.get(x, y) && !inEye(x, y) && !inLogo(x, y);

  let modules = '';
  const o = margin;
  switch (style.shape) {
    case 'square':
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!dark(x, y)) continue;
          let len = 1;
          while (x + len < size && dark(x + len, y)) len++;
          modules += rect(o + x, o + y, len, 1);
          x += len - 1;
        }
      }
      break;
    case 'dots':
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) if (dark(x, y)) modules += circle(o + x + 0.5, o + y + 0.5, 0.46);
      break;
    case 'bars':
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          if (!dark(x, y)) continue;
          let len = 1;
          while (y + len < size && dark(x, y + len)) len++;
          const w = 0.86;
          const r = w / 2;
          const left = o + x + (1 - w) / 2;
          const top = o + y;
          modules += `M${f(left)} ${f(top + r)}A${f(r)} ${f(r)} 0 0 1 ${f(left + w)} ${f(top + r)}V${f(top + len - r)}A${f(r)} ${f(r)} 0 0 1 ${f(left)} ${f(top + len - r)}z`;
          y += len - 1;
        }
      }
      break;
    case 'rounded':
    case 'classy':
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!dark(x, y)) continue;
          if (style.shape === 'classy') {
            modules += cornerPath(o + x, o + y, o + x + 1, o + y + 1, 0.5, 0, 0.5, 0);
            continue;
          }
          const t = dark(x, y - 1);
          const r = dark(x + 1, y);
          const b = dark(x, y + 1);
          const l = dark(x - 1, y);
          modules += cornerPath(
            o + x - (l ? SEAM : 0),
            o + y - (t ? SEAM : 0),
            o + x + 1 + (r ? SEAM : 0),
            o + y + 1 + (b ? SEAM : 0),
            !t && !l ? 0.5 : 0,
            !t && !r ? 0.5 : 0,
            !b && !r ? 0.5 : 0,
            !b && !l ? 0.5 : 0,
          );
        }
      }
      break;
  }

  let eyes = '';
  for (const [ex, ey] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const) {
    const x = o + ex;
    const y = o + ey;
    if (style.eyeFrame === 'square') eyes += rect(x, y, 7, 7) + rect(x + 1, y + 1, 5, 5);
    else if (style.eyeFrame === 'rounded') eyes += rrect(x, y, 7, 7, 2) + rrect(x + 1, y + 1, 5, 5, 1.1);
    else eyes += circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
    if (style.eyeBall === 'square') eyes += rect(x + 2, y + 2, 3, 3);
    else if (style.eyeBall === 'rounded') eyes += rrect(x + 2, y + 2, 3, 3, 0.9);
    else eyes += circle(x + 3.5, y + 3.5, 1.5);
  }

  const fg = safeColor(style.fg, '#000000');
  const fg2 = style.fg2 ? safeColor(style.fg2, fg) : null;
  let defs = '';
  let paint = fg;
  if (fg2) {
    const c = total / 2;
    if (style.gradient === 'radial') {
      defs = `<radialGradient id="${id}-g" gradientUnits="userSpaceOnUse" cx="${f(c)}" cy="${f(c)}" r="${f(c * 1.2)}"><stop offset="0" stop-color="${fg}"/><stop offset="1" stop-color="${fg2}"/></radialGradient>`;
    } else {
      const a = (style.gradientAngle * Math.PI) / 180;
      const dx = Math.cos(a) * c;
      const dy = Math.sin(a) * c;
      defs = `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${f(c - dx)}" y1="${f(c - dy)}" x2="${f(c + dx)}" y2="${f(c + dy)}"><stop offset="0" stop-color="${fg}"/><stop offset="1" stop-color="${fg2}"/></linearGradient>`;
    }
    paint = `url(#${id}-g)`;
  }
  const eyePaint = style.eyeColor ? safeColor(style.eyeColor, fg) : paint;

  const px = options.px ? ` width="${options.px}" height="${options.px}"` : '';
  const label = options.title ? ` role="img" aria-label="${escapeAttr(options.title)}"` : '';
  const crisp =
    style.shape === 'square' && style.eyeFrame === 'square' && style.eyeBall === 'square'
      ? ' shape-rendering="crispEdges"'
      : '';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(total)} ${f(total)}"${px}${label}${crisp}>`;
  if (defs) svg += `<defs>${defs}</defs>`;
  if (style.bg) svg += `<rect width="${f(total)}" height="${f(total)}" fill="${safeColor(style.bg, '#ffffff')}"/>`;
  svg += `<path fill="${paint}" d="${modules}"/>`;
  svg += `<path fill="${eyePaint}" fill-rule="evenodd" d="${eyes}"/>`;

  if (box && style.logo?.href.startsWith('data:image/')) {
    const pad = Math.max(0.5, box.len * 0.06);
    svg += `<image href="${escapeAttr(style.logo.href)}" x="${f(o + box.x + pad)}" y="${f(o + box.y + pad)}" width="${f(box.len - pad * 2)}" height="${f(box.len - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `${svg}</svg>`;
}
