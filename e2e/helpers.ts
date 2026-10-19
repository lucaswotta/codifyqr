import { expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';

/** Decodes a PNG inside the browser and returns the QR text, or null. Pixels cross as base64, not number arrays. */
export async function decodePng(page: Page, buffer: Buffer): Promise<string | null> {
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  const raw = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let binary = '';
    for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { width: canvas.width, height: canvas.height, b64: btoa(binary) };
  }, dataUrl);
  const pixels = new Uint8ClampedArray(Buffer.from(raw.b64, 'base64'));
  return jsQR(pixels, raw.width, raw.height)?.data ?? null;
}

export async function fillContent(page: Page, value: string): Promise<void> {
  await page.locator('#f-text-content').fill(value);
  await expect(page.locator('.qr-img')).toBeVisible();
}

export const verifyState = (page: Page) => page.locator('.verify');
