import { luminance, parseHex } from './color';
import type { QrStyle } from './style';

export const FRAME_IDS = ['none', 'sticker', 'card', 'table', 'wifi', 'pix'] as const;
export type FrameId = (typeof FRAME_IDS)[number];

export interface FrameText {
  headline: string;
  subline: string;
  footnote: string;
}

export interface Composition {
  svg: string;
  /** Abstract drawing units; only the ratio matters for raster output. */
  width: number;
  height: number;
  /** Natural print size, when the template has one. */
  mm: { width: number; height: number } | null;
  /** Side of the QR code in drawing units. */
  qr: number;
}

interface Layout {
  width: number;
  height: number;
  mm: { width: number; height: number };
  qr: number;
}

const LAYOUTS: Record<Exclude<FrameId, 'none'>, Layout> = {
  sticker: { width: 1000, height: 1180, mm: { width: 80, height: 94.4 }, qr: 740 },
  card: { width: 1800, height: 1000, mm: { width: 90, height: 50 }, qr: 760 },
  table: { width: 1050, height: 1480, mm: { width: 105, height: 148 }, qr: 760 },
  wifi: { width: 1480, height: 2100, mm: { width: 148, height: 210 }, qr: 1000 },
  pix: { width: 1050, height: 1480, mm: { width: 105, height: 148 }, qr: 700 },
};

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function onColor(background: string): string {
  return luminance(background) > 0.35 ? '#111111' : '#ffffff';
}

interface TextOptions {
  x: number;
  y: number;
  size: number;
  maxWidth: number;
  fill: string;
  weight?: number;
  anchor?: 'start' | 'middle';
}

/** Shrinks text to fit, and splits it in two lines at a space when it is still too wide. */
function fitText(value: string, o: TextOptions): string {
  const text = value.trim();
  if (!text) return '';
  const width = (s: string, size: number) => s.length * size * 0.58;
  const anchor = o.anchor ?? 'middle';
  let size = o.size;
  let lines = [text];
  if (width(text, size) > o.maxWidth) {
    const shrunk = Math.max(o.size * 0.6, o.maxWidth / (text.length * 0.58));
    if (width(text, shrunk) <= o.maxWidth || !text.includes(' ')) {
      size = shrunk;
    } else {
      const mid = text.length / 2;
      let cut = -1;
      for (let i = 0; i < text.length; i++)
        if (text[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
      lines = [text.slice(0, cut), text.slice(cut + 1)];
      size = Math.max(o.size * 0.5, Math.min(o.size, o.maxWidth / (Math.max(...lines.map((l) => l.length)) * 0.58)));
    }
  }
  return lines
    .map(
      (line, i) =>
        `<text x="${o.x}" y="${Math.round(o.y + i * size * 1.15)}" font-family="${FONT}" font-size="${Math.round(size)}" font-weight="${o.weight ?? 700}" fill="${o.fill}" text-anchor="${anchor}">${esc(line)}</text>`,
    )
    .join('');
}

/** Places an SVG document inside another one, replacing any size on its root element. */
export function embedSvg(svg: string, x: number, y: number, width: number, height = width): string {
  return svg.replace(/^<svg\s([^>]*)>/, (_m, attrs: string) => {
    const rest = attrs.replace(/\s(?:x|y|width|height)="[^"]*"/g, '').replace(/^(?:x|y|width|height)="[^"]*"\s?/g, '');
    return `<svg x="${x}" y="${y}" width="${width}" height="${height}" ${rest}>`;
  });
}

const nested = embedSvg;

export function composeFrame(id: FrameId, qrSvg: string, text: FrameText, style: QrStyle): Composition {
  if (id === 'none') return { svg: qrSvg, width: 1, height: 1, mm: null, qr: 1 };

  const layout = LAYOUTS[id];
  const { width: W, height: H } = layout;
  const accent = parseHex(style.fg2 ?? style.fg) ? (style.fg2 ?? style.fg) : '#183c36';
  const paper = style.bg && parseHex(style.bg) ? style.bg : '#ffffff';
  const onAccent = onColor(accent);
  const onPaper = onColor(paper);
  const root = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
  let body = '';

  switch (id) {
    case 'sticker':
      body += `<rect width="${W}" height="${H}" rx="90" fill="${accent}"/>`;
      body += fitText(text.headline, { x: 500, y: 150, size: 110, maxWidth: 840, fill: onAccent });
      body += `<rect x="110" y="230" width="780" height="780" rx="56" fill="${paper}"/>`;
      body += nested(qrSvg, 130, 250, 740);
      body += fitText(text.subline, { x: 500, y: 1100, size: 52, maxWidth: 840, fill: onAccent, weight: 600 });
      break;
    case 'card':
      body += `<rect width="${W}" height="${H}" fill="${paper}"/>`;
      body += `<rect width="40" height="${H}" fill="${accent}"/>`;
      body += fitText(text.headline, { x: 130, y: 420, size: 120, maxWidth: 780, fill: onPaper, anchor: 'start' });
      body += fitText(text.subline, {
        x: 130,
        y: 600,
        size: 64,
        maxWidth: 780,
        fill: onPaper,
        weight: 500,
        anchor: 'start',
      });
      body += fitText(text.footnote, {
        x: 130,
        y: 860,
        size: 48,
        maxWidth: 780,
        fill: onPaper,
        weight: 400,
        anchor: 'start',
      });
      body += nested(qrSvg, 960, 120, 760);
      break;
    case 'table':
      body += `<rect width="${W}" height="${H}" fill="${paper}"/>`;
      body += `<rect width="${W}" height="36" fill="${accent}"/>`;
      body += fitText(text.headline, { x: 525, y: 240, size: 110, maxWidth: 900, fill: onPaper });
      body += nested(qrSvg, 145, 400, 760);
      body += fitText(text.subline, { x: 525, y: 1300, size: 62, maxWidth: 900, fill: onPaper, weight: 500 });
      body += fitText(text.footnote, { x: 525, y: 1390, size: 42, maxWidth: 900, fill: onPaper, weight: 400 });
      break;
    case 'wifi':
      body += `<rect width="${W}" height="${H}" fill="${paper}"/>`;
      body += `<rect x="0" y="0" width="${W}" height="60" fill="${accent}"/>`;
      body += fitText(text.headline, { x: 740, y: 400, size: 230, maxWidth: 1240, fill: onPaper });
      body += nested(qrSvg, 240, 600, 1000);
      body += fitText(text.subline, { x: 740, y: 1830, size: 100, maxWidth: 1240, fill: onPaper, weight: 600 });
      body += fitText(text.footnote, { x: 740, y: 1980, size: 64, maxWidth: 1240, fill: onPaper, weight: 400 });
      break;
    case 'pix':
      body += `<rect width="${W}" height="${H}" fill="${paper}"/>`;
      body += `<rect width="${W}" height="330" fill="${accent}"/>`;
      body += fitText(text.headline, { x: 525, y: 210, size: 120, maxWidth: 900, fill: onAccent });
      body += nested(qrSvg, 175, 420, 700);
      body += fitText(text.subline, { x: 525, y: 1250, size: 62, maxWidth: 900, fill: onPaper, weight: 600 });
      body += fitText(text.footnote, { x: 525, y: 1360, size: 52, maxWidth: 900, fill: onPaper, weight: 400 });
      break;
  }
  return { svg: root(body), width: W, height: H, mm: layout.mm, qr: layout.qr };
}
