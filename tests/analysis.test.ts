import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance, mix } from '../src/qr/color';
import { DEFAULT_STYLE, type QrStyle } from '../src/qr/style';
import { planQr } from '../src/qr/svg';
import { applyFix, FIX_ORDER, staticCauses } from '../src/verify/analysis';

const plan = (style: QrStyle, text = 'https://example.com') => planQr(text, style);
const ids = (style: QrStyle, text?: string) => staticCauses(style, plan(style, text)).map((c) => `${c.id}:${c.level}`);

describe('color', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(luminance('#ffffff')).toBe(1);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('staticCauses', () => {
  it('accepts the default style', () => {
    expect(ids(DEFAULT_STYLE)).toEqual([]);
  });

  it('grades contrast', () => {
    expect(ids({ ...DEFAULT_STYLE, fg: '#bbbbbb' })).toEqual(['contrast:fail']);
    expect(ids({ ...DEFAULT_STYLE, fg: '#6a6a6a' })).toEqual([]);
    expect(ids({ ...DEFAULT_STYLE, fg: '#8a8a8a' })).toEqual(['contrast:risk']);
  });

  it('flags light modules on a dark background', () => {
    expect(ids({ ...DEFAULT_STYLE, fg: '#ffffff', bg: '#111111' })).toEqual(['inverted:risk']);
  });

  it('judges a transparent background against white', () => {
    expect(ids({ ...DEFAULT_STYLE, fg: '#bbbbbb', bg: null })).toEqual(['contrast:fail']);
  });

  it('warns about a thin border and about very dense codes', () => {
    expect(ids({ ...DEFAULT_STYLE, margin: 1 })).toContain('margin:risk');
    expect(ids(DEFAULT_STYLE, 'x'.repeat(900))).toContain('dense:risk');
  });

  it('warns when the logo is clamped', () => {
    const style: QrStyle = { ...DEFAULT_STYLE, ecc: 'L', logo: { href: 'data:image/png;base64,AA', ratio: 0.3 } };
    expect(ids(style)).toContain('logo:risk');
  });
});

describe('applyFix', () => {
  const p = plan(DEFAULT_STYLE);

  it('swaps an inverted code', () => {
    const fixed = applyFix('invert', { ...DEFAULT_STYLE, fg: '#ffffff', bg: '#111111' }, p)!;
    expect([fixed.fg, fixed.bg]).toEqual(['#111111', '#ffffff']);
  });

  it('strengthens weak colors without changing their hue family', () => {
    const fixed = applyFix('contrast', { ...DEFAULT_STYLE, fg: '#8a8a8a' }, p)!;
    expect(contrastRatio(fixed.fg, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('removes gradients, shrinks logos, resets shapes and the border', () => {
    expect(applyFix('gradient', { ...DEFAULT_STYLE, fg2: '#abcdef' }, p)!.fg2).toBeNull();
    expect(applyFix('shape', { ...DEFAULT_STYLE, shape: 'dots', eyeFrame: 'circle' }, p)).toMatchObject({
      shape: 'square',
      eyeFrame: 'square',
      eyeBall: 'square',
    });
    expect(applyFix('margin', { ...DEFAULT_STYLE, margin: 1 }, p)!.margin).toBe(4);
    const logo = { href: 'data:image/png;base64,AA', ratio: 0.3 };
    const lp = plan({ ...DEFAULT_STYLE, logo });
    expect(applyFix('logo', { ...DEFAULT_STYLE, logo }, lp)!.logo!.ratio).toBeLessThan(0.3);
    expect(applyFix('ecc', { ...DEFAULT_STYLE, ecc: 'L' }, p)!.ecc).toBe('auto');
  });

  it('returns null when a fix would change nothing', () => {
    for (const id of FIX_ORDER) expect(applyFix(id, DEFAULT_STYLE, p), id).toBeNull();
  });
});
