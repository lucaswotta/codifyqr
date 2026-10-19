// Composes the social preview (1280x640) from the wordmark, the tagline and a screenshot of the app.
// Run scripts/media/capture.mjs first: it writes docs/media/hero-light.png.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const url = (p) => `file://${resolve(process.cwd(), p)}`;
const wordmark = readFileSync('brand/wordmark.svg', 'utf8').replace(/<\?xml[^>]*>/, '');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Geist;font-weight:100 900;src:url(${url('src/assets/fonts/geist-latin-wght-normal.woff2')}) format('woff2')}
*{box-sizing:border-box;margin:0}
body{width:1280px;height:640px;background:#f5f4ef;color:#000;font-family:Geist,sans-serif;display:grid;grid-template-columns:600px 1fr;gap:1px;background:#000}
.left{background:#f5f4ef;padding:56px 56px 48px;display:grid;grid-template-rows:auto 1fr auto}
.left svg{height:96px;width:auto}
h1{align-self:center;font-size:68px;line-height:1.02;letter-spacing:-0.04em;font-weight:750}
h1 em{font-style:normal;color:#c8231a}
.meta{font:500 17px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#57544c}
.right{background:#f5f4ef;overflow:hidden;position:relative}
.right img{position:absolute;left:-170px;top:0;width:1100px}
</style><div class="left">${wordmark}<h1>Your definitive <em>QR code</em> platform.</h1><div class="meta">Free · Open source · No tracking</div></div>
<div class="right"><img src="${url('docs/media/hero-light.png')}"></div>`;

mkdirSync('.scratch', { recursive: true });
writeFileSync('.scratch/social.html', html);
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(url('.scratch/social.html'));
await page.waitForFunction(() => document.fonts.ready.then(() => true) && document.images[0].complete);
await page.screenshot({ path: 'brand/social-preview.png' });
await browser.close();
copyFileSync('brand/social-preview.png', 'public/social-preview.png');
console.log('wrote brand/social-preview.png');
