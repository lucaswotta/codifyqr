// Regenerates the images in docs/media from the running production build.
// Usage: pnpm build && pnpm preview --port 4173 & node scripts/media/capture.mjs
// Needs ffmpeg on the PATH.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.CODIFYQR_URL ?? 'http://localhost:4173/codifyqr/';
const OUT = 'docs/media';
const TMP = '.scratch/media';
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const chip = (page, text) => page.locator('label.chip', { hasText: new RegExp(`^${text}$`) }).first();
const waitState = (page, state) =>
  page.waitForFunction(
    (s) =>
      document.querySelector('.verify')?.dataset.state === s ||
      (s === 'risk|fail' && ['risk', 'fail'].includes(document.querySelector('.verify')?.dataset.state)),
    state,
    { timeout: 20000 },
  );

async function newPage(scheme = 'light', viewport = { width: 1200, height: 800 }) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, locale: 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(BASE);
  return page;
}

// Hero screenshots, both themes.
for (const scheme of ['light', 'dark']) {
  const page = await newPage(scheme, { width: 1200, height: 820 });
  await page.locator('#f-text-content').fill('https://lucaswotta.github.io/codifyqr/');
  await chip(page, 'Rounded').click();
  await page.locator('#c-fg').fill('#183c36');
  await waitState(page, 'ok');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${OUT}/hero-${scheme}.png` });
  await page.context().close();
}

// Read check states side by side.
{
  const page = await newPage('light');
  const shots = [];
  const verify = page.locator('.verify');
  await page.locator('#f-text-content').fill('https://example.com/menu');
  await waitState(page, 'ok');
  await verify.screenshot({ path: `${TMP}/v-ok.png` });
  await page.locator('#c-fg').fill('#8a8a8a');
  await waitState(page, 'risk|fail');
  await verify.screenshot({ path: `${TMP}/v-risk.png` });
  await page.locator('#c-fg').fill('#d8d8d8');
  await waitState(page, 'risk|fail');
  await page.waitForTimeout(800);
  await verify.screenshot({ path: `${TMP}/v-fail.png` });
  await page.context().close();
}

// Styles gallery and frames, from exported PNGs.
{
  const page = await newPage('light');
  await page.locator('#f-text-content').fill('https://example.com/styles');
  await page.locator('#png-size').selectOption('512');
  const save = async (name) => {
    const [d] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'PNG', exact: true }).click(),
    ]);
    writeFileSync(`${TMP}/${name}.png`, readFileSync(await d.path()));
  };
  const eyes = async (frame, ball) => {
    await page.locator('[aria-label="Eye frame"] label.chip', { hasText: new RegExp(`^${frame}$`) }).click();
    await page.locator('[aria-label="Eye center"] label.chip', { hasText: new RegExp(`^${ball}$`) }).click();
  };
  await page.locator('#c-fg').fill('#183c36');
  await page.locator('#c-bg').fill('#f5f3ea');
  const looks = [
    ['Square', 'Square', 'Square'],
    ['Rounded', 'Rounded', 'Rounded'],
    ['Dots', 'Circle', 'Circle'],
    ['Classy', 'Rounded', 'Square'],
    ['Bars', 'Square', 'Circle'],
  ];
  for (const [i, [shape, frame, ball]] of looks.entries()) {
    await chip(page, shape).click();
    await eyes(frame, ball);
    await save(`g${i}`);
  }
  await chip(page, 'Rounded').click();
  await eyes('Rounded', 'Rounded');
  await chip(page, 'Radial').click();
  await page.locator('#c-fg').fill('#0b3c8a');
  await page.locator('#c-fg2').fill('#0e7490');
  await page.locator('#logo-file').setInputFiles('brand/logo-symbol.png');
  await page.getByRole('button', { name: 'Remove logo' }).waitFor();
  await save('g5');
  await page.locator('#c-fg').fill('#183c36');
  await chip(page, 'None').click();
  await page.locator('#logo-file').setInputFiles([]);
  await page.getByRole('button', { name: 'Remove logo' }).click();
  await page.locator('summary', { hasText: 'Frame' }).click();
  for (const [name, label] of [
    ['sticker', 'Sticker'],
    ['card', 'Business card'],
    ['table', 'Table card'],
    ['wifi', 'Wi-Fi sign'],
    ['pix', 'Pix payment'],
  ]) {
    await chip(page, label).click();
    await save(`f-${name}`);
  }
  await page.context().close();
}

// Demo animation: one pass through the main features.
{
  const page = await newPage('light', { width: 1100, height: 700 });
  const frames = [];
  const shot = async (seconds) => {
    const file = `${TMP}/d${String(frames.length).padStart(2, '0')}.png`;
    await page.mouse.move(0, 0);
    await page.screenshot({ path: file });
    frames.push([file.replace(`${TMP}/`, ''), seconds]);
  };
  await shot(1.2);
  const input = page.locator('#f-text-content');
  await input.pressSequentially('https://codify', { delay: 20 });
  await shot(0.6);
  await input.pressSequentially('qr.example/menu');
  await waitState(page, 'ok');
  await shot(1.6);
  await chip(page, 'Rounded').click();
  await page.locator('[aria-label="Eye frame"] label.chip', { hasText: /^Rounded$/ }).click();
  await page.locator('[aria-label="Eye center"] label.chip', { hasText: /^Circle$/ }).click();
  await page.waitForTimeout(500);
  await shot(1.2);
  await page.locator('[data-preset="ocean"]').click();
  await waitState(page, 'ok');
  await shot(1.4);
  await page.locator('#logo-file').setInputFiles('brand/logo-symbol.png');
  await page.getByRole('button', { name: 'Remove logo' }).waitFor();
  await waitState(page, 'ok');
  await shot(1.8);
  await page.locator('#c-fg').fill('#9aa0a6');
  await page.locator('#c-fg2').fill('#b8bdc2');
  await waitState(page, 'risk|fail');
  await page.waitForTimeout(900);
  await shot(2.2);
  await page.locator('.verify .btn').click();
  await waitState(page, 'ok');
  await shot(1.8);
  await chip(page, 'Pix').click();
  await page.locator('#f-pix-key').fill('529.982.247-25');
  await page.locator('#f-pix-name').fill('Ana Conceição');
  await page.locator('#f-pix-city').fill('São Paulo');
  await page.locator('#f-pix-amount').fill('25,90');
  await waitState(page, 'ok');
  await shot(2.4);
  await page.context().close();
  const list = `${frames.map(([f, d]) => `file '${f}'\nduration ${d}`).join('\n')}\nfile '${frames.at(-1)[0]}'\n`;
  writeFileSync(`${TMP}/frames.txt`, list);
}

await browser.close();

const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
ff([
  '-i',
  `${TMP}/v-ok.png`,
  '-i',
  `${TMP}/v-risk.png`,
  '-i',
  `${TMP}/v-fail.png`,
  '-filter_complex',
  '[0]scale=420:-1[a];[1]scale=420:-1[b];[2]scale=420:-1[c];[a][b][c]vstack=inputs=3:shortest=0',
  `${OUT}/read-check.png`,
]);
ff([
  ...[0, 1, 2, 3, 4, 5].flatMap((i) => ['-i', `${TMP}/g${i}.png`]),
  '-filter_complex',
  '[0]scale=320:-1[a];[1]scale=320:-1[b];[2]scale=320:-1[c];[3]scale=320:-1[d];[4]scale=320:-1[e];[5]scale=320:-1[f];[a][b][c]hstack=inputs=3[r1];[d][e][f]hstack=inputs=3[r2];[r1][r2]vstack=inputs=2',
  `${OUT}/styles.png`,
]);
ff([
  ...['sticker', 'card', 'table', 'wifi', 'pix'].flatMap((n) => ['-i', `${TMP}/f-${n}.png`]),
  '-filter_complex',
  '[0]scale=-1:560[a];[1]scale=560:-1,pad=560:560:0:(560-ih)/2:color=white[b];[2]scale=-1:560[c];[3]scale=-1:560[d];[4]scale=-1:560[e];[a][b][c][d][e]hstack=inputs=5',
  `${OUT}/frames.png`,
]);
ff([
  '-f',
  'concat',
  '-i',
  `${TMP}/frames.txt`,
  '-vf',
  'fps=10,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4',
  `${OUT}/demo.gif`,
]);
console.log('wrote', OUT);
