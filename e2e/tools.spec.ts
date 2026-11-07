import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { chip, decodePng, downloadPng, fillContent, openTab } from './helpers';

function zipEntries(zip: Buffer): { name: string; data: Buffer }[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = zip.readUInt16LE(offset + 28);
    const extra = zip.readUInt16LE(offset + 30);
    const comment = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    entries.push({
      name: zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
      data: zip.subarray(start, start + zip.readUInt32LE(offset + 24)),
    });
    offset += 46 + nameLength + extra + comment;
  }
  return entries;
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
  const entries = zipEntries(await readFile(await download.path()));
  expect(entries.map((entry) => entry.name)).toEqual(['Shop-A.png', 'Shop-A-2.png', 'code-003.png', 'evil.png']);
  const expected = [
    'https://example.com/a',
    'https://example.com/b',
    'https://example.com/c',
    'https://example.com/d?x=1,2',
  ];
  for (const [index, entry] of entries.entries()) expect(await decodePng(page, entry.data)).toBe(expected[index]);
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
  expect(zipEntries(await readFile(await download.path())).map((entry) => entry.name)).toEqual(['one.svg', 'two.svg']);
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

test('the reader decodes an image pasted from the clipboard only while Scan is open', async ({ page }) => {
  await page.goto('./');
  await fillContent(page, 'https://example.com/pasted');
  const png = (await downloadPng(page)).toString('base64');
  const paste = () =>
    page.evaluate((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], 'clip.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, png);
  await paste();
  await expect(page.locator('.scan-text')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Scan' }).click();
  await expect(page.locator('#scan-file')).toBeAttached();
  await paste();
  await expect(page.locator('.scan-text')).toHaveText('https://example.com/pasted');
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

for (const shape of ['Square', 'Rounded', 'Dots', 'Classy', 'Bars']) {
  test(`batch PNG preserves ${shape} modules, gradient, eyes and SVG logo`, async ({ page }) => {
    await page.goto('./');
    await openTab(page, 'Style');
    await chip(page, shape).first().click();
    await page.locator('[aria-label="Eye frame"] label.chip', { hasText: /^Rounded$/ }).click();
    await page.locator('[aria-label="Eye center"] label.chip', { hasText: /^Circle$/ }).click();
    await chip(page, 'Radial').click();
    await page.locator('#c-fg').fill('#0b3c8a');
    await page.locator('#c-fg2').fill('#0e7490');
    await page.locator('#c-eye').fill('#7c2d12');
    await page.locator('#logo-file').setInputFiles({
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><path d="M0 0h80v40H0z" fill="navy"/></svg>',
      ),
    });
    await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
    await page.getByRole('tab', { name: 'Batch' }).click();
    const content = 'https://example.com/styles?name=Zoë';
    await page.locator('#batch-input').fill(content);
    await page.locator('label[for="batch-size-512"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Create ZIP' }).click(),
    ]);
    const entries = zipEntries(await readFile(await download.path()));
    expect(entries).toHaveLength(1);
    expect(await decodePng(page, entries[0]!.data)).toBe(content);
  });
}

test('500 PNGs run in a worker with progress painted between rows', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./');
  await page.getByRole('tab', { name: 'Batch' }).click();
  await page
    .locator('#batch-input')
    .fill(Array.from({ length: 500 }, (_, index) => `https://example.com/batch/${index}`).join('\n'));
  await page.locator('label[for="batch-size-512"]').click();
  await expect(page.getByText('500 codes')).toBeVisible();
  await page.evaluate(() => {
    const progress = document.querySelector<HTMLProgressElement>('#batch progress')!;
    const samples: number[] = [];
    const sample = () => {
      if (!progress.hidden && progress.value > 0 && progress.value < 1) samples.push(progress.value);
      requestAnimationFrame(sample);
    };
    Object.assign(window, { batchProgress: samples });
    requestAnimationFrame(sample);
  });
  const [worker, download] = await Promise.all([
    page.waitForEvent('worker'),
    page.waitForEvent('download', { timeout: 150_000 }),
    page.getByRole('button', { name: 'Create ZIP' }).click(),
  ]);
  expect(worker.url()).toContain('batch.worker');
  const samples = await page.evaluate(() => (window as unknown as { batchProgress: number[] }).batchProgress);
  expect(new Set(samples).size).toBeGreaterThan(1);
  expect(samples).toEqual([...samples].sort((a, b) => a - b));
  const entries = zipEntries(await readFile(await download.path()));
  expect(entries).toHaveLength(500);
  for (const index of [0, 249, 499]) {
    expect(await decodePng(page, entries[index]!.data)).toBe(`https://example.com/batch/${index}`);
  }
  await expect(page.getByRole('button', { name: 'Create ZIP' })).toBeEnabled();
});

test.describe('batch worker startup', () => {
  test.use({ serviceWorkers: 'block' });

  test('batch reports worker startup failure and allows retry', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('tab', { name: 'Batch' }).click();
    await page.locator('#batch-input').fill('https://example.com/retry');
    await page.route('**/batch.worker-*.js', (route) => route.abort());
    await page.getByRole('button', { name: 'Create ZIP' }).click();
    await expect(page.locator('#batch [role="status"]')).toHaveText('Could not create the file.');
    await expect(page.getByRole('button', { name: 'Create ZIP' })).toBeEnabled();
    await expect(page.locator('#batch-input')).toBeEnabled();
    await page.unroute('**/batch.worker-*.js');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Create ZIP' }).click(),
    ]);
    expect(zipEntries(await readFile(await download.path()))).toHaveLength(1);
  });
});
