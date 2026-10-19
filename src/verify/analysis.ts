import { contrastRatio, luminance, mix, parseHex } from '../qr/color';
import { MAX_LOGO_RATIO, type QrStyle } from '../qr/style';
import type { QrPlan } from '../qr/svg';

export type CauseId = 'contrast' | 'inverted' | 'logo' | 'margin' | 'gradient' | 'shape' | 'dense' | 'mismatch';
export type Level = 'risk' | 'fail';
export interface Cause {
  id: CauseId;
  level: Level;
}

export type FixId = 'invert' | 'contrast' | 'gradient' | 'logo' | 'ecc' | 'shape' | 'margin';
export const FIX_ORDER: readonly FixId[] = ['invert', 'contrast', 'gradient', 'logo', 'ecc', 'shape', 'margin'];

const WHITE = '#ffffff';

function foregroundColors(style: QrStyle): string[] {
  return [style.fg, style.fg2, style.eyeColor].filter((c): c is string => !!c && !!parseHex(c));
}

function backdrop(style: QrStyle): string {
  return style.bg && parseHex(style.bg) ? style.bg : WHITE;
}

/** Problems visible from the style alone, before any decoding. */
export function staticCauses(style: QrStyle, plan: QrPlan): Cause[] {
  const causes: Cause[] = [];
  const bg = backdrop(style);
  const colors = foregroundColors(style);
  const worst = Math.min(...colors.map((c) => contrastRatio(c, bg)));
  const lightOnDark = colors.some((c) => luminance(c) > luminance(bg));

  if (lightOnDark) causes.push({ id: 'inverted', level: 'risk' });
  else if (worst < 3) causes.push({ id: 'contrast', level: 'fail' });
  else if (worst < 4.5) causes.push({ id: 'contrast', level: 'risk' });

  if (style.logo) {
    const max = MAX_LOGO_RATIO[plan.matrix.ecc];
    if (plan.logoClamped) causes.push({ id: 'logo', level: 'risk' });
    else if (plan.logoRatio > max * 0.85) causes.push({ id: 'logo', level: 'risk' });
  }
  if (style.margin < 2) causes.push({ id: 'margin', level: 'risk' });
  if (plan.matrix.version > 20) causes.push({ id: 'dense', level: 'risk' });
  return causes;
}

function strengthen(color: string, bg: string): string {
  if (contrastRatio(color, bg) >= 4.5) return color;
  const target = luminance(bg) > 0.5 ? '#000000' : WHITE;
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const candidate = mix(color, target, t);
    if (contrastRatio(candidate, bg) >= 4.5) return candidate;
  }
  return target;
}

/** Returns the style with one fix applied, or null when the fix would change nothing. */
export function applyFix(id: FixId, style: QrStyle, plan: QrPlan): QrStyle | null {
  const next: QrStyle = { ...style };
  switch (id) {
    case 'invert': {
      const bg = backdrop(style);
      const colors = foregroundColors(style);
      if (!colors.some((c) => luminance(c) > luminance(bg))) return null;
      next.fg = bg;
      next.bg = style.fg;
      next.fg2 = null;
      next.eyeColor = null;
      return next;
    }
    case 'contrast': {
      const bg = backdrop(style);
      next.fg = strengthen(style.fg, bg);
      next.fg2 = style.fg2 ? strengthen(style.fg2, bg) : null;
      next.eyeColor = style.eyeColor ? strengthen(style.eyeColor, bg) : null;
      return next.fg === style.fg && next.fg2 === style.fg2 && next.eyeColor === style.eyeColor ? null : next;
    }
    case 'gradient':
      if (!style.fg2) return null;
      next.fg2 = null;
      return next;
    case 'logo':
      if (!style.logo) return null;
      next.logo = { ...style.logo, ratio: Math.min(style.logo.ratio, MAX_LOGO_RATIO[plan.matrix.ecc] * 0.7) };
      return next.logo.ratio === style.logo.ratio ? null : next;
    case 'ecc':
      if (style.ecc === 'auto' || style.ecc === 'H') return null;
      next.ecc = 'auto';
      return next;
    case 'shape':
      if (style.shape === 'square' && style.eyeFrame === 'square' && style.eyeBall === 'square') return null;
      next.shape = 'square';
      next.eyeFrame = 'square';
      next.eyeBall = 'square';
      return next;
    case 'margin':
      if (style.margin >= 4) return null;
      next.margin = 4;
      return next;
  }
}
