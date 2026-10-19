import { describe, expect, it } from 'vitest';
import { DataTooLongError } from '../src/qr/encoder';
import { DEFAULT_STYLE, MAX_LOGO_RATIO, MODULE_SHAPES, type QrStyle } from '../src/qr/style';
import { planQr, renderQrSvg } from '../src/qr/svg';

const logo = { href: 'data:image/png;base64,AAAA', ratio: 0.3 };

describe('planQr', () => {
  it('uses M and boosts for free when there is no logo', () => {
    const plan = planQr('hello', DEFAULT_STYLE);
    expect(plan.matrix.version).toBe(1);
    expect(plan.matrix.ecc).toBe('H');
    expect(plan.logoRatio).toBe(0);
  });

  it('raises the ecc level and the minimum version for a logo', () => {
    const plan = planQr('hello', { ...DEFAULT_STYLE, logo });
    expect(plan.matrix.ecc).toBe('H');
    expect(plan.matrix.version).toBeGreaterThanOrEqual(5);
    expect(plan.logoRatio).toBe(0.3);
  });

  it('clamps the logo to what a fixed ecc level can recover', () => {
    const plan = planQr('hello', { ...DEFAULT_STYLE, ecc: 'L', logo });
    expect(plan.matrix.ecc).toBe('L');
    expect(plan.logoRatio).toBe(MAX_LOGO_RATIO.L);
    expect(plan.logoClamped).toBe(true);
  });

  it('throws when the text does not fit', () => {
    expect(() => planQr('x'.repeat(3000), DEFAULT_STYLE)).toThrow(DataTooLongError);
  });
});

describe('renderQrSvg', () => {
  it.each(MODULE_SHAPES)('renders well formed output for shape %s', (shape) => {
    const style: QrStyle = { ...DEFAULT_STYLE, shape, eyeFrame: 'rounded', eyeBall: 'circle', fg2: '#2244aa', logo };
    const svg = renderQrSvg(planQr('https://example.com', style), { px: 300, idPrefix: 'a' });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('width="300"');
    expect(svg).toContain('url(#a-g)');
    expect(svg).toContain('<image ');
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  it('leaves the quiet zone and the background transparent when asked', () => {
    const plan = planQr('hello', { ...DEFAULT_STYLE, bg: null, margin: 4 });
    const svg = renderQrSvg(plan);
    expect(svg).not.toContain('<rect width=');
    expect(svg).toContain(`viewBox="0 0 ${plan.matrix.size + 8} ${plan.matrix.size + 8}"`);
  });

  it('refuses to inject anything through colors, titles or logo hrefs', () => {
    const style: QrStyle = {
      ...DEFAULT_STYLE,
      fg: '"><script>x</script>',
      bg: 'red"onload="x',
      logo: { href: 'data:image/png;base64,AA"onload="x', ratio: 0.2 },
    };
    const svg = renderQrSvg(planQr('hello', style), { title: '"><b>' });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('onload="x"');
    expect(svg).not.toContain('<b>');
  });

  it('draws no module under the logo', () => {
    const withLogo = renderQrSvg(planQr('a'.repeat(60), { ...DEFAULT_STYLE, ecc: 'H', logo }));
    const without = renderQrSvg(planQr('a'.repeat(60), { ...DEFAULT_STYLE, ecc: 'H' }));
    const pathLength = (s: string) => /<path fill="[^"]*" d="([^"]*)"/.exec(s)![1]!.length;
    expect(pathLength(withLogo)).toBeLessThan(pathLength(without));
  });
});

describe('logo headroom', () => {
  it('picks a level that leaves room, so the default logo is not flagged', async () => {
    const { staticCauses } = await import('../src/verify/analysis');
    const style: QrStyle = { ...DEFAULT_STYLE, logo: { href: 'data:image/png;base64,AAAA', ratio: 0.22 } };
    const plan = planQr('https://example.com/some/longer/path?with=query', style);
    expect(plan.matrix.ecc).not.toBe('M');
    expect(staticCauses(style, plan).map((c) => c.id)).not.toContain('logo');
  });
});
