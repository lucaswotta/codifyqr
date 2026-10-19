import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { decodePng } from './helpers';

test('creates a verified QR code and downloads a readable PNG', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('./');
  await page.getByRole('textbox', { name: /link or text|enlace|link ou/i }).fill('https://example.com/olá?x=1');
  await expect(page.locator('.qr-img')).toBeVisible();
  await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^codifyqr-text-\d{8}-\d{4}\.png$/);
  const path = await download.path();
  expect(await decodePng(page, await readFile(path))).toBe('https://example.com/olá?x=1');
  expect(errors).toEqual([]);
});
