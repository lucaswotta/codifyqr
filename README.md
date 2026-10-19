# CodifyQR

CodifyQR is a free, open source QR code generator that runs entirely in the browser: no account, no tracking, and no network request after the page loads.

[Open the app](https://lucaswotta.github.io/codifyqr/) · [Português](README.pt-BR.md) · [Español](README.es.md)

![CodifyQR creating a styled QR code, failing the read check and fixing it](docs/media/demo.gif)

## What it does

- **Ten content types**: link or text, Pix (BR Code with CRC16), Wi-Fi, contact (vCard), email, SMS, WhatsApp, location, calendar event, app store link.
- **Styles**: five module shapes, three eye frames and three eye centers, gradients, transparent background, adjustable border, and a logo that replaces the modules under it instead of covering them. Frames for stickers, business cards, table cards, Wi-Fi signs and Pix charges.
- **Read check**: decodes the finished code at three simulated camera qualities (3, 5 and 10 pixels per module, with blur), says why it fails (contrast, inverted colors, logo size, border, density, shape) and offers a one-click fix.
- **Exports**: PNG at 512 to 4096 px, SVG, PDF with the print size in centimeters and a warning when modules fall under 0.4 mm, copy to clipboard, share.
- **Batch**: paste lines or import a CSV (content, optional file name), up to 500 rows, downloaded as a ZIP of PNG or SVG files.
- **Reader**: scans with the camera or from an image and shows what the code contains. It never opens a link by itself and warns about URL shorteners, look-alike domains, raw IP addresses, `http`, embedded credentials, and `javascript:` or `data:` content.
- **Offline PWA** with light and dark themes in English, Portuguese (Brazil) and Spanish.

| Styles | Frames |
| --- | --- |
| ![Module shapes, gradient and logo](docs/media/styles.png) | ![Sticker, card, table, Wi-Fi and Pix frames](docs/media/frames.png) |

![The read check in its three states](docs/media/read-check.png)

## Why the images are sharp

The encoder in `src/qr/encoder.ts` produces the module matrix and `src/qr/svg.ts` draws it as vector paths. PNG and PDF are rasterized from that vector at the size you pick. Version 1.x drew a 500 px bitmap and stretched it, which blurred the modules at 1024 and 2048 px.

The encoder follows the algorithm of [Project Nayuki's QR Code generator](https://www.nayuki.io/page/qr-code-generator-library) (MIT), rewritten in TypeScript. Every version (1 to 40) and error correction level is decoded back with jsQR in the unit tests. Version 23 is checked structurally because jsQR lists a wrong alignment pattern position for it. A separate script (`scripts/crosscheck`) exports 48 styled PNGs and reads them with zxing-cpp: 48 of 48 were read.

## Privacy

- The built page sets `Content-Security-Policy` with `connect-src 'none'` and `script-src 'self'`. The page cannot send data anywhere, and an end to end test fails if a request leaves the origin.
- No analytics, no cookies, no external fonts or scripts.
- Saved styles, style links (`#s=...`) and exported style files contain the look only. Pix keys, Wi-Fi passwords and other content are never stored, put in a URL or written to a log.
- Exported file names do not contain the content.

## Pix

The Pix builder writes a static BR Code (`br.gov.bcb.pix`, reusable) and validates the key before drawing: CPF and CNPJ check digits (including the alphanumeric CNPJ), phone numbers, email, and random keys. A CPF typed with punctuation that fails its check digits is rejected instead of being read as a phone number. Name and city are written without accents, in capitals, and cut to 25 and 15 characters as the specification requires. The payload ends with the CRC16/CCITT-FALSE checksum, tested against the sample in the Banco Central manual.

## Requirements and setup

- Node 22 or newer, pnpm 12 (`corepack enable`), Google Chrome for the end to end tests.

```sh
pnpm install
pnpm dev                 # http://localhost:5173/codifyqr/
pnpm build               # type check, then production build in dist/
pnpm preview             # serve dist/ on http://localhost:4173/codifyqr/
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e            # needs a build first
```

`CODIFYQR_BASE` changes the base path of the build (default `/codifyqr/`). Use `CODIFYQR_BASE=/` to serve from a domain root.

## Quality gates

CI (`.github/workflows/ci.yml`) runs on every push:

- Biome lint and format, TypeScript strict mode.
- Unit tests (Vitest) and end to end tests (Playwright, Chrome), including exported images decoded back to their text, offline use, the content security policy, translations, and axe accessibility checks (WCAG 2.2 AA, no serious violations).
- First load budget: 60 KB gzip (`scripts/size-budget.mjs`; currently about 35 KB).
- Lighthouse thresholds: performance at least 95, accessibility, best practices and SEO at 100 (`scripts/lighthouse-check.mjs`).

## Limitations

- Codes are always static. There is no redirect service, so a code cannot be edited after printing and nothing counts scans. That is deliberate: a printed code never depends on a server or a subscription.
- The PDF embeds a high resolution image (up to 600 dpi, less for large pages). For fully vector print files use the SVG.
- The read check simulates scanners; it does not prove that every phone will read a code. It decodes with the platform `BarcodeDetector` when the browser has one and with jsQR otherwise.
- The Pix builder creates static codes only. Dynamic charges need a payment service provider.
- Text is limited to 2000 characters, and to what fits in a version 40 code with the chosen error correction.
- The batch tool processes up to 500 rows on the main thread, in small steps.
- Safari before 16.4 has no `CompressionStream`; PDFs there use a lower resolution without compression.

## Project history

| Period | State |
| --- | --- |
| 2022 | One page that called a third party QR image API. |
| 2025-08 | Local generation with `qrcodejs` and PNG download. |
| 2025-09 | Logo, text, colors and three export sizes; stretched bitmap output. |
| 2026-10 | Rewrite: own encoder, vector rendering, read check, ten content types, PWA. See [CHANGELOG.md](CHANGELOG.md). |

## Contributing, security, license

See [CONTRIBUTING.md](CONTRIBUTING.md) (including how to add a language) and [SECURITY.md](SECURITY.md). MIT license, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
