import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { chip, downloadPng, fillContent } from './helpers';

function zipEntries(zip: Buffer): string[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = zip.readUInt16LE(offset + 28);
    const extra = zip.readUInt16LE(offset + 30);
    const comment = zip.readUInt16LE(offset + 32);
    names.push(zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + extra + comment;
  }
  return names;
}

test('batch turns pasted lines into a ZIP with safe unique names', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Batch' }).click();
  await page
    .locator('#batch-input')
    .fill(
      'https://example.com/a,Shop A\nhttps://example.com/b,Shop A\nexample.com/c\n"https://example.com/d?x=1,2",../evil',
    );
  await expect(page.getByText('4 codes')).toBeVisible();
  await page.locator('label[for="batch-size-512"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Create ZIP' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^codifyqr-batch-.*\.zip$/);
  const names = zipEntries(await readFile(await download.path()));
  expect(names).toEqual(['Shop-A.png', 'Shop-A-2.png', 'code-003.png', 'evil.png']);
});

test('batch accepts a CSV file and SVG output', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Batch' }).click();
  await page.locator('#batch-file').setInputFiles({
    name: 'codes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('content;name\nhttps://example.com/1;one\nhttps://example.com/2;two\n'),
  });
  await expect(page.getByText('2 codes')).toBeVisible();
  await page.locator('label[for="batch-format-svg"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Create ZIP' }).click(),
  ]);
  expect(zipEntries(await readFile(await download.path()))).toEqual(['one.svg', 'two.svg']);
});

test('the reader decodes an image, warns about risky links, and loads content into Create', async ({ page }) => {
  await page.goto('./');
  await fillContent(page, 'https://bit.ly/3abcdef');
  const png = await downloadPng(page);
  await fillContent(page, 'https://example.com/other');
  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.locator('#scan-file').setInputFiles({ name: 'code.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.scan-text')).toHaveText('https://bit.ly/3abcdef');
  await expect(page.locator('.scan-warn')).toContainText('URL shortener');
  const open = page.getByRole('link', { name: 'Open anyway' });
  await expect(open).toHaveAttribute('rel', /noopener/);
  await expect(open).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Edit in Create' }).click();
  await expect(page.getByRole('tab', { name: 'Create', selected: true })).toBeVisible();
  await expect(page.locator('#f-text-content')).toHaveValue('https://bit.ly/3abcdef');
});

test('the reader shows Pix and never offers to open non-web content', async ({ page }) => {
  await page.goto('./');
  await chip(page, 'Wi-Fi').click();
  await page.locator('#f-wifi-ssid').fill('Home');
  await page.locator('#f-wifi-password').fill('password123');
  await expect(page.locator('.verify')).toHaveAttribute('data-state', 'ok');
  const png = await downloadPng(page);
  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.locator('#scan-file').setInputFiles({ name: 'wifi.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.scan-text')).toContainText('WIFI:T:WPA;S:Home');
  await expect(page.getByText('Type: Wi-Fi network')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open/ })).toHaveCount(0);
});

test('an image without a QR code says so', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.locator('#scan-file').setInputFiles('e2e/fixtures/logo.png');
  await expect(page.getByText('No QR code found in that image.')).toBeVisible();
});
