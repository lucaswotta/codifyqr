import { expect, test } from '@playwright/test';
import { chip, decodePng, downloadPng, fillContent, verifyState } from './helpers';

const TEXT = 'https://example.com/styles?id=42&name=Zoë';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await fillContent(page, TEXT);
});

test('every module shape and eye style exports a readable PNG', async ({ page }) => {
  for (const shape of ['Square', 'Rounded', 'Dots', 'Classy', 'Bars']) {
    await chip(page, shape).first().click();
    for (const [frame, ball] of [
      ['Square', 'Square'],
      ['Rounded', 'Rounded'],
      ['Circle', 'Circle'],
    ]) {
      await page.locator('[aria-label="Eye frame"] label.chip', { hasText: new RegExp(`^${frame}$`) }).click();
      await page.locator('[aria-label="Eye center"] label.chip', { hasText: new RegExp(`^${ball}$`) }).click();
      expect(await decodePng(page, await downloadPng(page)), `${shape} ${frame}/${ball}`).toBe(TEXT);
    }
  }
});

test('gradients, custom eye color, transparent background and a logo still read', async ({ page }) => {
  await chip(page, 'Radial').click();
  await page.locator('#c-fg').fill('#0b3c8a');
  await page.locator('#c-fg2').fill('#0e7490');
  await page.locator('#c-eye').fill('#7c2d12');
  expect(await decodePng(page, await downloadPng(page))).toBe(TEXT);

  await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
  await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
  await expect(verifyState(page)).toHaveAttribute('data-state', 'ok');
  expect(await decodePng(page, await downloadPng(page))).toBe(TEXT);

  await page.locator('#r-logo').fill('0.32');
  await expect(verifyState(page)).toHaveAttribute('data-state', /ok|risk/);
  expect(await decodePng(page, await downloadPng(page))).toBe(TEXT);
});

test('the read check flags weak contrast and the suggested fix repairs it', async ({ page }) => {
  await page.locator('#c-fg').fill('#c8c8c8');
  await expect(verifyState(page)).toHaveAttribute('data-state', /risk|fail/);
  const fix = page.locator('.verify .btn');
  await expect(fix).toBeVisible();
  await fix.click();
  await expect(verifyState(page)).toHaveAttribute('data-state', 'ok');
});

test('light modules on a dark background are caught and fixed', async ({ page }) => {
  await page.locator('#c-fg').fill('#ffffff');
  await page.locator('#c-bg').fill('#111111');
  await expect(verifyState(page)).toHaveAttribute('data-state', /risk|fail/);
  await expect(page.locator('.verify-causes')).toContainText(/Light modules on a dark background/);
  await page.locator('.verify .btn').click();
  await expect(verifyState(page)).toHaveAttribute('data-state', 'ok');
});

test('fixed error correction clamps the logo size', async ({ page }) => {
  await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
  await chip(page, 'L \\(7%\\)').click();
  await page.locator('#r-logo').fill('0.32');
  await expect(page.getByText('Logo reduced so the code still reads.')).toBeVisible();
});
