import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { encodeText } from '../src/qr/encoder';

const DIR = 'test-results/camera';
const VIDEO = `${process.cwd()}/${DIR}/qr.y4m`;
const TEXT = 'https://example.com/camera?ok=1';
const W = 640;
const H = 480;
const WHITE = 235;
const BLACK = 16;

/** Writes a few frames of a QR code as a Y4M video, the format Chrome reads as a fake camera. */
function writeVideo(): void {
  const matrix = encodeText(TEXT);
  const scale = 10;
  const quiet = 4;
  const side = (matrix.size + quiet * 2) * scale;
  const x0 = Math.floor((W - side) / 2);
  const y0 = Math.floor((H - side) / 2);
  const y = new Uint8Array(W * H).fill(WHITE);
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(col, row)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++)
          y[(y0 + (quiet + row) * scale + dy) * W + x0 + (quiet + col) * scale + dx] = BLACK;
      }
    }
  }
  const chroma = new Uint8Array((W / 2) * (H / 2)).fill(128);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma, chroma]);
  writeFileSync(VIDEO, Buffer.concat([header, ...Array.from({ length: 30 }, () => frame)]));
}

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true });
  writeVideo();
});

// A fake camera that films a real QR code, so the live decoding path runs end to end.
test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
});

test('the camera reads a live QR code, stops itself, and can scan again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('.scan-text')).toHaveText(TEXT, { timeout: 20000 });
  await expect(page.locator('.reader-video')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible();

  await page.getByRole('button', { name: 'Scan another' }).click();
  await expect(page.locator('.reader-video')).toBeVisible();
  await expect(page.locator('.scan-text')).toHaveText(TEXT, { timeout: 20000 });

  await page.getByRole('button', { name: 'Scan another' }).click();
  await expect(page.locator('.reader-video')).toBeVisible();
  await page.getByRole('tab', { name: 'Create' }).click();
  const live = await page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.srcObject !== null));
  expect(live, 'the camera is released when the tool is hidden').toBe(false);
  expect(errors).toEqual([]);
});

test('stopping the camera by hand releases it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Scan' }).click();
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('.reader-video')).toBeVisible();
  await page.getByRole('button', { name: 'Stop camera' }).click();
  await expect(page.locator('.reader-video')).toBeHidden();
  expect(await page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.srcObject !== null))).toBe(
    false,
  );
});
