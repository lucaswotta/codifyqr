import { expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';

/**
 * Decodes a PNG with jsQR. The image is redrawn at a few sizes because jsQR, a small pure JS decoder,
 * misses some styled codes at particular scales that ZXing-based readers handle.
 */
export async function decodePng(page: Page, buffer: Buffer): Promise<string | null> {
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  for (const width of [512, 256, 360, 1024]) {
    const raw = await page.evaluate(
      async ({ url, target }) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const w = Math.min(target, img.naturalWidth);
        const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let binary = '';
        for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        return { width: w, height: h, b64: btoa(binary) };
      },
      { url: dataUrl, target: width },
    );
    const pixels = new Uint8ClampedArray(Buffer.from(raw.b64, 'base64'));
    const text = jsQR(pixels, raw.width, raw.height)?.data;
    if (text) return text;
  }
  return null;
}

export async function fillContent(page: Page, value: string): Promise<void> {
  await page.locator('#f-text-content').fill(value);
  await expect(page.locator('.qr-img')).toBeVisible();
}

export const verifyState = (page: Page) => page.locator('.verify');

export const chip = (page: Page, text: string) => page.locator('label.chip', { hasText: new RegExp(`^${text}$`) });

export async function downloadPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG', exact: true }).click(),
  ]);
  const path = await download.path();
  return (await import('node:fs/promises')).readFile(path);
}

/** Opens one of the inner tabs of the editor: Content, Style or Frame (English labels). */
export const openTab = (page: Page, name: 'Content' | 'Style' | 'Frame') => page.getByRole('tab', { name }).click();

export async function chooseLanguage(page: Page, code: 'EN' | 'PT' | 'ES'): Promise<void> {
  await page.locator('.menu-btn').click();
  await page.locator('.menu-item', { hasText: new RegExp(`^${code}`) }).click();
}
