import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Adds the strict CSP to the built page and writes the service worker with the list of built files. */
function productionShell(): Plugin {
  let outDir = 'dist';
  let base = '/';
  return {
    name: 'codifyqr-production-shell',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      base = config.base;
    },
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="utf-8" />',
        `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
    closeBundle: {
      order: 'post',
      handler() {
        const files = walk(outDir)
          .map((f) => relative(outDir, f).split('\\').join('/'))
          .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('social-preview'))
          .sort();
        // 404.html is served for any unknown path, so it needs absolute links.
        const notFound = join(outDir, '404.html');
        writeFileSync(notFound, readFileSync(notFound, 'utf8').replaceAll('__BASE__', base));
        const hash = createHash('sha256');
        for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
        const urls = ['./', ...files.map((f) => `./${f}`)];
        const template = readFileSync('scripts/sw.template.js', 'utf8');
        writeFileSync(
          join(outDir, 'sw.js'),
          template
            .replace('__VERSION__', hash.digest('hex').slice(0, 12))
            .replace('__FILES__', JSON.stringify(urls, null, 2)),
        );
      },
    },
  };
}

export default defineConfig({
  base: process.env.CODIFYQR_BASE ?? '/codifyqr/',
  plugins: [productionShell()],
  build: { target: 'es2022', cssCodeSplit: false, sourcemap: false, assetsInlineLimit: 4096 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
