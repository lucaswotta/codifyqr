import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { crc16, pixPayload } from '../src/payloads/pix';
import { chip, decodePng, downloadPng, verifyState } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('Pix: validates, detects the key type, and encodes a payload with a valid CRC', async ({ page }) => {
  await chip(page, 'Pix').click();
  await page.locator('#f-pix-key').fill('529.982.247-26');
  await page.locator('#f-pix-key').blur();
  await expect(page.getByText('Not a valid Pix key')).toBeVisible();

  await page.locator('#f-pix-key').fill('529.982.247-25');
  await expect(page.getByText('Detected: CPF')).toBeVisible();
  await page.locator('#f-pix-name').fill('Ana Conceição');
  await page.locator('#f-pix-city').fill('São Paulo');
  await page.locator('#f-pix-amount').fill('25,90');
  await expect(verifyState(page)).toHaveAttribute('data-state', 'ok');

  const decoded = await decodePng(page, await downloadPng(page));
  expect(decoded).toBe(pixPayload({ key: '52998224725', name: 'ANA CONCEICAO', city: 'SAO PAULO', amount: '25.90' }));
  expect(decoded!.slice(-4)).toBe(crc16(decoded!.slice(0, -4)));
});

test('Pix content is never written to storage', async ({ page }) => {
  await chip(page, 'Pix').click();
  await page.locator('#f-pix-key').fill('ana@example.com');
  await page.locator('#f-pix-name').fill('Ana');
  await page.locator('#f-pix-city').fill('Recife');
  await page.getByRole('button', { name: 'Save current style' }).click();
  const dump = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href,
  );
  expect(dump).not.toContain('ana@example.com');
  expect(dump).not.toContain('Recife');
});

test('Wi-Fi payload decodes to the standard string', async ({ page }) => {
  await chip(page, 'Wi-Fi').click();
  await page.locator('#f-wifi-ssid').fill('Café Bar');
  await page.locator('#f-wifi-password').fill('s3nha;forte');
  await expect(verifyState(page)).toHaveAttribute('data-state', 'ok');
  expect(await decodePng(page, await downloadPng(page))).toBe(String.raw`WIFI:T:WPA;S:Café Bar;P:s3nha\;forte;;`);
});

test('contact, email, WhatsApp, location, event and app store build and read', async ({ page }) => {
  await chip(page, 'Contact').click();
  await page.locator('#f-vcard-firstName').fill('Ana');
  await page.locator('#f-vcard-lastName').fill('Silva');
  await page.locator('#f-vcard-email').fill('ana@example.com');
  expect(await decodePng(page, await downloadPng(page))).toContain('FN:Ana Silva');

  await chip(page, 'Email').click();
  await page.locator('#f-email-to').fill('ana@example.com');
  await page.locator('#f-email-subject').fill('Oi');
  expect(await decodePng(page, await downloadPng(page))).toBe('mailto:ana@example.com?subject=Oi');

  await chip(page, 'WhatsApp').click();
  await page.locator('#f-whatsapp-phone').fill('+55 11 91234-5678');
  expect(await decodePng(page, await downloadPng(page))).toBe('https://wa.me/5511912345678');

  await chip(page, 'Location').click();
  await page.locator('#f-geo-lat').fill('-23.5505');
  await page.locator('#f-geo-lon').fill('-46.6333');
  expect(await decodePng(page, await downloadPng(page))).toBe('geo:-23.5505,-46.6333');

  await chip(page, 'Event').click();
  await page.locator('#f-event-title').fill('Launch');
  await page.locator('#f-event-start').fill('2026-11-05T09:00');
  expect(await decodePng(page, await downloadPng(page))).toContain('DTSTART:20261105T090000');

  await chip(page, 'App store').click();
  await page.locator('#f-app-id').fill('com.example.app');
  expect(await decodePng(page, await downloadPng(page))).toBe(
    'https://play.google.com/store/apps/details?id=com.example.app',
  );
});

test('bare domains get https and the page says so', async ({ page }) => {
  await page.locator('#f-text-content').fill('example.com/promo');
  await expect(page.getByText('Added https://')).toBeVisible();
  expect(await decodePng(page, await downloadPng(page))).toBe('https://example.com/promo');
});

test('too much content shows a clear message instead of failing', async ({ page }) => {
  await page.locator('#f-text-content').fill('é'.repeat(1200));
  await expect(page.locator('.stage-error')).toContainText('too long');
  await expect(verifyState(page)).toHaveAttribute('data-state', 'empty');
});

test('frames wrap the code and the PNG still reads', async ({ page }) => {
  await page.locator('#f-text-content').fill('https://example.com/menu');
  await page.locator('summary', { hasText: 'Frame' }).click();
  for (const frame of ['Sticker', 'Business card', 'Table card', 'Wi-Fi sign', 'Pix payment']) {
    await chip(page, frame).click();
    await page.locator('#frame-headline').fill('Scan to see the menu');
    expect(await decodePng(page, await downloadPng(page)), frame).toBe('https://example.com/menu');
  }
});

test('SVG download is a standalone vector file with the logo embedded', async ({ page }) => {
  await page.locator('#f-text-content').fill('https://example.com/vector');
  await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
  await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'SVG', exact: true }).click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');
  expect(svg.startsWith('<?xml')).toBe(true);
  expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('<image href="data:image/png;base64,');
  expect(svg).not.toMatch(/<script|onload=|https?:\/\/(?!www\.w3\.org)/);
});

test('PDF download is a valid one page document at the chosen size', async ({ page }) => {
  await page.locator('#f-text-content').fill('https://example.com/print');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByText(/Module size: \d/)).toBeVisible();
  await page.locator('#pdf-qr').fill('1');
  await expect(page.getByText('Modules under 0.4 mm')).toBeVisible();
  await page.locator('#pdf-qr').fill('6');
  await expect(page.getByText('Modules under 0.4 mm')).toBeHidden();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Create PDF' }).click(),
  ]);
  const bytes = await readFile(await download.path());
  const head = bytes.subarray(0, 8).toString('latin1');
  expect(head).toBe('%PDF-1.4');
  const text = bytes.toString('latin1');
  expect(text).toContain('/MediaBox [0 0 ');
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
});
