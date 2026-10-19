// Composes the social preview (1280x640): wordmark, tagline and a real QR code that opens the site.
// The QR comes from the project's own encoder and renderer, so the image advertises what the app does.
// Usage: node scripts/brand/render-social.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const SITE = 'https://lucaswotta.github.io/codifyqr/';
const url = (p) => `file://${resolve(process.cwd(), p)}`;

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
const { planQr, renderQrSvg } = await vite.ssrLoadModule('/src/qr/svg.ts');
const { DEFAULT_STYLE } = await vite.ssrLoadModule('/src/qr/style.ts');
const logo = `data:image/png;base64,${readFileSync('brand/logo-symbol.png').toString('base64')}`;
const plan = planQr(SITE, {
  ...DEFAULT_STYLE,
  shape: 'rounded',
  eyeFrame: 'rounded',
  eyeBall: 'rounded',
  fg: '#000000',
  eyeColor: '#c8231a',
  bg: '#ffffff',
  logo: { href: logo, ratio: 0.2 },
});
const qr = renderQrSvg(plan, { px: 440, title: `QR code for ${SITE}` });
await vite.close();

const wordmark = readFileSync('brand/wordmark.svg', 'utf8').replace(/<\?xml[^>]*>/, '');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Geist;font-weight:100 900;src:url(${url('src/assets/fonts/geist-latin-wght-normal.woff2')}) format('woff2')}
*{box-sizing:border-box;margin:0}
body{width:1280px;height:640px;font-family:Geist,sans-serif;color:#000;background:#000;display:grid;grid-template-columns:1fr 520px;gap:1px}
.left{background:#f5f4ef;padding:64px 56px 52px 64px;display:grid;grid-template-rows:auto 1fr auto}
.left svg{height:92px;width:auto}
h1{align-self:center;font-size:72px;line-height:1.02;letter-spacing:-0.04em;font-weight:750}
h1 em{font-style:normal;color:#c8231a}
.meta{font:500 18px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#57544c}
.right{background:#f5f4ef;display:grid;place-items:center;align-content:center;gap:22px}
.card{background:#fff;padding:20px;border:1px solid #000;line-height:0}
.card svg{width:440px;height:440px}
.link{font:600 20px ui-monospace,Menlo,monospace;letter-spacing:.02em}
</style>
<div class="left">${wordmark}<h1>Your definitive<br><em>QR code</em> platform.</h1><div class="meta">Free · Open source · No tracking</div></div>
<div class="right"><div class="card">${qr}</div><div class="link">lucaswotta.github.io/codifyqr</div></div>`;

mkdirSync('.scratch', { recursive: true });
writeFileSync('.scratch/social.html', html);
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(url('.scratch/social.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'brand/social-preview.png' });
await browser.close();
copyFileSync('brand/social-preview.png', 'public/social-preview.png');
console.log('wrote brand/social-preview.png for', SITE);
