// Renders the PNG brand assets from the SVG sources with Chrome.
// Usage: node scripts/brand/render-assets.mjs   (needs Playwright and Chrome, see CONTRIBUTING.md)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const url = (p) => `file://${resolve(root, p)}`;
const INK = '#000000';

const jobs = [
  { svg: 'brand/logo-symbol.svg', out: 'brand/logo-symbol.png', w: 512, h: 512 },
  { svg: 'brand/logo-symbol.svg', out: 'public/icons/icon-512.png', w: 512, h: 512 },
  { svg: 'brand/logo-symbol.svg', out: 'public/icons/icon-192.png', w: 192, h: 192 },
  { svg: 'brand/logo-symbol.svg', out: 'public/icons/apple-touch-icon.png', w: 180, h: 180 },
  { svg: 'brand/logo-symbol.svg', out: 'public/icons/maskable-512.png', w: 512, h: 512, inner: 384, bg: INK },
  { svg: 'brand/favicon.svg', out: 'brand/favicon-32.png', w: 32, h: 32 },
  { svg: 'brand/favicon.svg', out: 'brand/favicon-16.png', w: 16, h: 16 },
  { svg: 'brand/mascot-ok.svg', out: 'brand/mascot-ok.png', w: 512, h: 512 },
  { svg: 'brand/mascot-risk.svg', out: 'brand/mascot-risk.png', w: 512, h: 512 },
  { svg: 'brand/mascot-fail.svg', out: 'brand/mascot-fail.png', w: 512, h: 512 },
  { svg: 'brand/wordmark.svg', out: 'brand/wordmark.png', w: 1020, h: 316 },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const job of jobs) {
  const size = job.inner ?? job.w;
  const pad = (job.w - size) / 2;
  await page.setViewportSize({ width: job.w, height: job.h });
  await page.goto('about:blank');
  await page.setContent(
    `<body style="margin:0;background:${job.bg ?? 'transparent'}"><img src="${url(job.svg)}" style="position:absolute;left:${pad}px;top:${pad}px;width:${size}px;height:${job.inner ? size : job.h}px"></body>`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: job.out, omitBackground: !job.bg });
  console.log('wrote', job.out);
}
copyFileSync('brand/favicon.svg', 'public/favicon.svg');
await browser.close();
