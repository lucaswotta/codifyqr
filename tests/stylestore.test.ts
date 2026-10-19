import { describe, expect, it } from 'vitest';
import { exportStyleJson, importStyleJson, sanitizeStyle, styleFromHash, styleToHash } from '../src/app/stylestore';
import { DEFAULT_STYLE } from '../src/qr/style';

describe('sanitizeStyle', () => {
  it('returns the defaults for garbage', () => {
    for (const input of [null, undefined, 42, 'x', [], {}]) expect(sanitizeStyle(input)).toEqual(DEFAULT_STYLE);
  });

  it('rejects unknown enums, bad colors and out of range numbers', () => {
    const s = sanitizeStyle({
      shape: 'triangle',
      fg: 'javascript:1',
      bg: 'url(x)',
      margin: 99,
      gradientAngle: -5,
      ecc: 'Z',
      logo: { href: 'http://x', ratio: 5 },
    });
    expect(s.shape).toBe('square');
    expect(s.fg).toBe('#111111');
    expect(s.bg).toBe('#ffffff');
    expect(s.margin).toBe(8);
    expect(s.gradientAngle).toBe(0);
    expect(s.ecc).toBe('auto');
    expect(s.logo).toBeNull();
  });

  it('keeps valid values, normalizes case and caps the logo ratio', () => {
    const s = sanitizeStyle({
      shape: 'dots',
      fg: '#ABCDEF',
      fg2: '#123',
      bg: null,
      logo: { href: 'data:image/png;base64,AAAA', ratio: 0.9 },
    });
    expect(s).toMatchObject({ shape: 'dots', fg: '#abcdef', fg2: '#123', bg: null });
    expect(s.logo).toEqual({ href: 'data:image/png;base64,AAAA', ratio: 0.32 });
  });
});

describe('style transport', () => {
  it('round trips through the link without the logo', () => {
    const style = {
      ...DEFAULT_STYLE,
      shape: 'bars' as const,
      fg: '#0b3c8a',
      fg2: '#0e7490',
      logo: { href: 'data:image/png;base64,AAAA', ratio: 0.2 },
    };
    const hash = styleToHash(style);
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+$/);
    expect(styleFromHash(hash)).toEqual({ ...style, logo: null });
  });

  it('ignores malformed links', () => {
    for (const hash of ['', '#', '#s=', '#s=@@@', '#s=bm90LWpzb24', '#x=1']) expect(styleFromHash(hash)).toBeNull();
  });

  it('round trips through the exported file and rejects other JSON', () => {
    const style = { ...DEFAULT_STYLE, shape: 'classy' as const };
    expect(importStyleJson(exportStyleJson(style))).toEqual(style);
    expect(importStyleJson('{"style":{}}')).toBeNull();
    expect(importStyleJson('nope')).toBeNull();
  });
});
