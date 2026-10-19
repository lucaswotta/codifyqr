// Records one GIF per phase of the project from the commits listed below, plus a side by side comparison.
// Usage: pnpm build && pnpm preview --port 4173 & node scripts/media/evolution.mjs
// Needs git, ffmpeg and network access: the old phases load qrcodejs and fonts from CDNs, and the 2022 page
// calls a third party QR API. Output goes to docs/media/evolution.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = 'docs/media/evolution';
const TMP = '.scratch/evolution';
const NOW_URL = process.env.CODIFYQR_URL ?? 'http://localhost:4173/codifyqr/';
const FONT = process.env.FONT ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const SITE = 'https://example.com/menu';
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = normalize(join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      const file =
        path.startsWith(dir) && existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path;
      if (!file.startsWith(dir) || !existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);

const PHASES = [
  {
    id: '2022-10',
    caption: '2022: one page, QR image from a third party API',
    commit: '004d276',
    async run(page, shot) {
      await shot(1.2);
      await page.locator('.form input').fill(SITE);
      await shot(1);
      await page.locator('.form button').click();
      await page.waitForFunction(
        () => {
          const i = document.querySelector('.qr-code .img');
          return i && i.complete && i.naturalWidth > 0;
        },
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(900);
      await shot(3);
    },
  },
  {
    id: '2025-08',
    caption: '2025-08: local generation with qrcodejs, PNG download',
    commit: 'c46d0a5',
    async run(page, shot) {
      await shot(1.2);
      await page.locator('#qr-input').fill(SITE);
      await shot(1);
      await page.locator('.generate-btn').click();
      await page.waitForSelector('.container.show-result #qrcode-canvas img', { timeout: 20000 });
      await page.waitForTimeout(1200);
      await shot(3);
    },
  },
  {
    id: '2025-09',
    caption: '2025-09: logo, text, colors, three sizes (stretched bitmap)',
    commit: 'cd6e7c9',
    async run(page, shot) {
      await shot(1.2);
      await page.locator('#qr-input').fill(SITE);
      await page.locator('#template-text-input').fill('Menu');
      await page.locator('#logo-upload').setInputFiles('brand/logo-symbol.png');
      await page.locator('.color-swatch[data-color="#059669"]').click();
      await shot(1.4);
      await page.locator('.generate-btn').click();
      await page.waitForSelector('.container.show-result', { timeout: 20000 });
      await page.waitForTimeout(1500);
      await shot(3);
    },
  },
  {
    id: '2026-10',
    caption: '2026-10: print-inspired editor, vector output, read check',
    commit: null,
    async run(page, shot) {
      await shot(1.2);
      const input = page.locator('#f-text-content');
      await input.fill(SITE);
      await page.waitForFunction(() => document.querySelector('.verify')?.dataset.state === 'ok', null, {
        timeout: 20000,
      });
      await shot(1.4);
      await page.locator('label[for="shape-square"]').click();
      await page.locator('[data-preset="ink"]').click();
      await page.locator('#logo-file').setInputFiles('brand/logo-symbol.png');
      await page.locator('#r-logo').waitFor();
      await page.waitForFunction(() => document.querySelector('.verify')?.dataset.state === 'ok', null, {
        timeout: 20000,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(3);
    },
  },
];

const browser = await chromium.launch({ channel: 'chrome' });
const clips = [];
for (const phase of PHASES) {
  const dir = join(TMP, phase.id);
  mkdirSync(dir, { recursive: true });
  let base = NOW_URL;
  let server = null;
  if (phase.commit) {
    const tree = join(process.cwd(), TMP, `tree-${phase.id}`);
    mkdirSync(tree, { recursive: true });
    execFileSync('sh', ['-c', `git archive ${phase.commit} | tar -x -C "${tree}"`]);
    const served = await serve(tree);
    server = served.server;
    base = served.url;
  }
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const frames = [];
  const shot = async (seconds) => {
    const name = `f${String(frames.length).padStart(2, '0')}.png`;
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(dir, name) });
    frames.push([name, seconds]);
  };
  await phase.run(page, shot);
  await ctx.close();
  server?.close();
  writeFileSync(
    join(dir, 'frames.txt'),
    `${frames.map(([f, d]) => `file '${f}'\nduration ${d}`).join('\n')}\nfile '${frames.at(-1)[0]}'\n`,
  );
  const total = frames.reduce((n, [, d]) => n + d, 0);
  const caption = phase.caption.replace(/:/g, '\\:').replace(/'/g, '');
  ff([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(dir, 'frames.txt'),
    '-vf',
    `fps=10,scale=900:600,pad=900:650:0:0:color=0x15302c,drawtext=fontfile=${FONT}:text='${caption}':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=600+(50-text_h)/2`,
    '-c:v',
    'ffv1',
    join(TMP, `${phase.id}.mkv`),
  ]);
  clips.push({ id: phase.id, total });
  console.log(phase.id, 'frames', frames.length, `${total}s`);
}
await browser.close();

const longest = Math.max(...clips.map((c) => c.total));
for (const c of clips) {
  ff([
    '-i',
    join(TMP, `${c.id}.mkv`),
    '-vf',
    `tpad=stop_mode=clone:stop_duration=${longest - c.total + 0.5}`,
    '-c:v',
    'ffv1',
    join(TMP, `${c.id}-padded.mkv`),
  ]);
  ff([
    '-i',
    join(TMP, `${c.id}.mkv`),
    '-vf',
    'fps=8,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    join(OUT, `${c.id}.gif`),
  ]);
}
ff([
  ...clips.flatMap((c) => ['-i', join(TMP, `${c.id}-padded.mkv`)]),
  '-filter_complex',
  '[0]scale=640:-1[a];[1]scale=640:-1[b];[2]scale=640:-1[c];[3]scale=640:-1[d];[a][b]hstack[r1];[c][d]hstack[r2];[r1][r2]vstack,fps=8,split[x][y];[x]palettegen=max_colors=128[p];[y][p]paletteuse=dither=bayer:bayer_scale=4',
  join(OUT, 'comparison.gif'),
]);
console.log('wrote', OUT);
