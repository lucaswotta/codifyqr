import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chip, decodePng, downloadPng, fillContent } from './helpers';

test('first code in under five seconds, no requests beyond the page itself, no console errors', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  const problems: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) external.push(r.url());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(m.text()));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`),
    );
  });

  const start = Date.now();
  await page.goto('./');
  await fillContent(page, 'https://example.com');
  await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
  const png = await downloadPng(page);
  expect(Date.now() - start).toBeLessThan(5000);
  expect(await decodePng(page, png)).toBe('https://example.com');
  expect(external).toEqual([]);
  expect(problems).toEqual([]);
});

test('production page ships the strict content security policy', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});

test('interface switches language and remembers it', async ({ page }) => {
  await page.goto('./');
  await page.locator('.lang-select').selectOption('es');
  await expect(page.locator('h1')).toHaveText('Códigos QR que nunca salen de tu navegador.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Códigos QR que nunca salen de tu navegador.');
  await page.locator('.lang-select').selectOption('pt-BR');
  await expect(page.getByText('Link ou texto').first()).toBeVisible();
});

test('typed content survives a language change', async ({ page }) => {
  await page.goto('./');
  await fillContent(page, 'https://example.com/keep');
  await page.locator('.lang-select').selectOption('pt-BR');
  await expect(page.locator('#f-text-content')).toHaveValue('https://example.com/keep');
  await expect(page.locator('.qr-img')).toBeVisible();
});

test('theme button cycles and the choice is applied to the page', async ({ page }) => {
  await page.goto('./');
  const root = page.locator('html');
  await page.locator('.icon-btn').click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.locator('.icon-btn').click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.locator('.icon-btn').click();
  await expect(root).not.toHaveAttribute('data-theme', /.+/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`no serious accessibility violations (${scheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('./');
    await fillContent(page, 'https://example.com');
    await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
    await chip(page, 'Pix').click();
    for (const tab of ['Create', 'Batch', 'Scan']) {
      await page.getByRole('tab', { name: tab }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
        `${scheme} ${tab}`,
      ).toEqual([]);
    }
    await context.close();
  });
}

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await fillContent(page, 'https://example.com/offline');
  await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
  expect(await decodePng(page, await downloadPng(page))).toBe('https://example.com/offline');
  await context.setOffline(false);
});

test('a shared style link restores the look and carries no content', async ({ page, baseURL }) => {
  await page.goto('./');
  await fillContent(page, 'secret content');
  await chip(page, 'Dots').first().click();
  await page.locator('#c-fg').fill('#0b3c8a');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy link to this style' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).not.toContain('secret');
  expect(Buffer.from(link.split('#s=')[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).not.toContain(
    'secret',
  );

  const other = await page.context().newPage();
  await other.goto(link.replace(/^https?:\/\/[^/]+/, new URL(baseURL!).origin));
  await expect(other.locator('input#shape-dots')).toBeChecked();
  await expect(other.locator('#c-fg')).toHaveValue('#0b3c8a');
  await expect(other.locator('#f-text-content')).toHaveValue('');
});

test('hostile style data in the link is sanitized', async ({ page }) => {
  const hostile = Buffer.from(
    JSON.stringify({
      shape: '"><img src=x onerror=alert(1)>',
      fg: 'red;}</style><script>1</script>',
      margin: 9999,
      logo: { href: 'javascript:alert(1)' },
    }),
  ).toString('base64url');
  await page.goto(`./#s=${hostile}`);
  await expect(page.locator('input#shape-square')).toBeChecked();
  await expect(page.locator('#c-fg')).toHaveValue('#111111');
  await expect(page.locator('#r-margin')).toHaveValue('8');
  await expect(page.locator('script:not([src]):not([type])')).toHaveCount(0);
});

test('saved styles persist the look only', async ({ page }) => {
  await page.goto('./');
  await fillContent(page, 'private text');
  await chip(page, 'Bars').first().click();
  await page.locator('#style-name').fill('Mine');
  await page.getByRole('button', { name: 'Save current style' }).click();
  await page.reload();
  await expect(page.getByText('Mine')).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('codifyqr.styles'));
  expect(stored).not.toContain('private text');
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('input#shape-bars')).toBeChecked();
});
