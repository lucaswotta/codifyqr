import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chip, chooseLanguage, decodePng, downloadPng, fillContent, openTab } from './helpers';

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
  await chooseLanguage(page, 'ES');
  await expect(page.locator('.status-tagline')).toHaveText('Tu plataforma de código QR definitiva.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.locator('.status-tagline')).toHaveText('Tu plataforma de código QR definitiva.');
  await chooseLanguage(page, 'PT');
  await expect(page.getByText('Link ou texto').first()).toBeVisible();
});

test('language menu shows full names, works with the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('./');
  const button = page.locator('.menu-btn');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: /Português \(Brasil\)/ })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toBeHidden();
  await expect(button).toBeFocused();
});

test('typed content survives a language change and theme switch', async ({ page }) => {
  await page.goto('./');
  await fillContent(page, 'https://example.com/keep');
  await page.getByRole('tab', { name: 'Batch' }).click();
  await page.locator('#batch-input').fill('https://example.com/1,one\nhttps://example.com/2,two');
  await page.locator('.icon-btn[aria-label^="Theme"]').click();
  await expect(page.locator('#batch-input')).toHaveValue('https://example.com/1,one\nhttps://example.com/2,two');
  await chooseLanguage(page, 'PT');
  await expect(page.locator('#batch-input')).toHaveValue('https://example.com/1,one\nhttps://example.com/2,two');
  await expect(page.getByText('2 códigos')).toBeVisible();
  await page.getByRole('tab', { name: 'Criar' }).click();
  await expect(page.locator('#f-text-content')).toHaveValue('https://example.com/keep');
  await expect(page.locator('.qr-img')).toBeVisible();
});

test('theme button cycles and the choice is applied to the page', async ({ page }) => {
  await page.goto('./');
  const root = page.locator('html');
  const theme = () => page.locator('.icon-btn[aria-label^="Theme"]');
  await theme().click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await theme().click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await theme().click();
  await expect(root).not.toHaveAttribute('data-theme', /.+/);
});

test('keyboard shortcuts cover types, panels, exports and app actions', async ({ page }) => {
  await page.goto('./');
  const selected = (name: string) => page.getByRole('tab', { name, selected: true });
  await page.keyboard.press('2');
  await expect(page.locator('#kind-pix')).toBeChecked();
  await page.keyboard.press('1');
  await expect(page.locator('#kind-text')).toBeChecked();
  await page.keyboard.press('s');
  await expect(selected('Style')).toBeVisible();
  await page.keyboard.press('f');
  await expect(selected('Frame')).toBeVisible();
  await page.keyboard.press('c');
  await expect(selected('Content')).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(page.locator('#f-text-content')).toBeFocused();
  await page.keyboard.type('https://example.com/keys');
  await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
  const [png] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+Enter')]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);

  await page.locator('.status-bar, .statusbar').click({ position: { x: 5, y: 5 } });
  const [png2] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('p')]);
  expect(png2.suggestedFilename()).toMatch(/\.png$/);
  const [svg] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('v')]);
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  await page.keyboard.press('d');
  await expect(page.getByRole('dialog', { name: 'PDF for printing' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press(']');
  await expect(page.getByRole('tab', { name: 'Batch', selected: true })).toBeVisible();
  await page.keyboard.press('[');
  await expect(page.getByRole('tab', { name: 'Create', selected: true })).toBeVisible();

  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('l');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.keyboard.press('l');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.keyboard.press('l');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.keyboard.press('h');
  await expect(page.getByRole('dialog', { name: 'How to use CodifyQR' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('kbd')).toHaveCount(await dialog.locator('kbd').count());
  expect(await dialog.locator('kbd').count()).toBeGreaterThan(15);
});

test('single-key shortcuts can be switched off and Ctrl combinations keep working', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Shift+?');
  await page.getByLabel('Single-key shortcuts').uncheck();
  await page.keyboard.press('Escape');
  await page.keyboard.press('2');
  await expect(page.locator('#kind-text')).toBeChecked();
  await page.keyboard.press('t');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await page.keyboard.press('Control+k');
  await expect(page.locator('#f-text-content')).toBeFocused();
  await page.reload();
  await page.keyboard.press('2');
  await expect(page.locator('#kind-text')).toBeChecked();
});

test('help explains the steps, tips and terms, and links to the shortcuts', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.getByRole('dialog', { name: 'How to use CodifyQR' });
  await expect(help).toBeVisible();
  await expect(help.locator('.help-steps li')).toHaveCount(5);
  await expect(help.getByText('Check that it reads')).toBeVisible();
  await expect(help.getByText('Tips for printing')).toBeVisible();
  await help.getByRole('button', { name: 'See keyboard shortcuts' }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('the page fills the viewport and never scrolls, in every mode and size', async ({ browser }) => {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1920, 1080],
  ]) {
    const context = await browser.newContext({ viewport: { width: width!, height: height! }, locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('./');
    await fillContent(page, 'https://example.com/fit');
    for (const mode of ['Create', 'Batch', 'Scan']) {
      await page.getByRole('tab', { name: mode }).click();
      const size = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
        iw: innerWidth,
        ih: innerHeight,
        body: getComputedStyle(document.body).overflow,
      }));
      expect(size.sw, `${width}x${height} ${mode} width`).toBe(size.iw);
      expect(size.sh, `${width}x${height} ${mode} height`).toBe(size.ih);
    }
    await context.close();
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`no serious accessibility violations (${scheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('./');
    await fillContent(page, 'https://example.com');
    await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
    await chip(page, 'Pix').click();
    for (const tab of ['Create', 'Style', 'Frame', 'Batch', 'Scan']) {
      if (tab === 'Style' || tab === 'Frame') await openTab(page, tab);
      else await page.getByRole('tab', { name: tab }).click();
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
  await openTab(page, 'Style');
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
  await openTab(page, 'Style');
  await chip(page, 'Bars').first().click();
  await page.locator('#style-name').fill('Mine');
  await page.getByRole('button', { name: 'Save current style' }).click();
  await page.reload();
  await openTab(page, 'Style');
  await expect(page.getByText('Mine')).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('codifyqr.styles'));
  expect(stored).not.toContain('private text');
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('input#shape-bars')).toBeChecked();
});
