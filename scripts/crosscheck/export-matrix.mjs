// Exports the style matrix through the UI. Set CODIFYQR_URL to test another address.

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ acceptDownloads: true, locale: 'en-US' });
const page = await ctx.newPage();
await page.goto(process.env.CODIFYQR_URL ?? 'http://localhost:4173/codifyqr/');
await page.locator('#f-text-content').fill('https://example.com/styles?id=42&name=Zoë');
const chip = (t) => page.locator('label.chip', { hasText: new RegExp(`^${t}$`) }).first();
async function snap(name, size) {
  await page.locator('#png-size').selectOption(String(size));
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG', exact: true }).click(),
  ]);
  writeFileSync(`${out}/${name}-${size}.png`, readFileSync(await d.path()));
}
for (const shape of ['Square', 'Rounded', 'Dots', 'Classy', 'Bars']) {
  await chip(shape).click();
  for (const eye of ['Square', 'Rounded', 'Circle']) {
    await page.locator('[aria-label="Eye frame"] label.chip', { hasText: new RegExp(`^${eye}$`) }).click();
    await page.locator('[aria-label="Eye center"] label.chip', { hasText: new RegExp(`^${eye}$`) }).click();
    for (const size of [512, 1024, 2048]) await snap(`${shape}_${eye}`, size);
  }
}
// gradient + logo variants on rounded
await chip('Rounded').click();
await page.locator('[aria-label="Eye frame"] label.chip', { hasText: /^Square$/ }).click();
await page.locator('[aria-label="Eye center"] label.chip', { hasText: /^Square$/ }).click();
await chip('Radial').click();
await page.locator('#c-fg').fill('#0b3c8a');
await page.locator('#c-fg2').fill('#0e7490');
await snap('RoundedGradient', 1024);
await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
await page.getByRole('button', { name: 'Remove logo' }).waitFor();
await snap('RoundedGradientLogo', 1024);
await page.locator('#r-logo').fill('0.32');
await snap('RoundedGradientLogoMax', 1024);
await browser.close();
