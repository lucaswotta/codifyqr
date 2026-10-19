import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { encodeText } from '../src/qr/encoder';
import { rasterize } from '../tests/helpers';

const DIR = 'test-results/camera';
const VIDEO = `${process.cwd()}/${DIR}/qr.y4m`;
const TEXT = 'https://example.com/camera?ok=1';

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true });
  const { data, width } = rasterize(encodeText(TEXT), 8, 4);
  writeFileSync(`${DIR}/qr.rgba`, data);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-video_size',
    `${width}x${width}`,
    '-framerate',
    '10',
    '-i',
    `${DIR}/qr.rgba`,
    '-frames:v',
    '30',
    '-vf',
    'scale=480:480:flags=neighbor,pad=640:480:80:0:color=white',
    '-pix_fmt',
    'yuv420p',
    VIDEO,
  ]);
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
