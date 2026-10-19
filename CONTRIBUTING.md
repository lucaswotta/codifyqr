# Contributing

## Setup

Requirements: Node 22 or newer, pnpm 12 (`corepack enable` picks the version from `package.json`), and Google Chrome for the end to end tests (the camera test films a generated QR code with Chrome's fake camera).

```sh
pnpm install
pnpm dev            # http://localhost:5173/codifyqr/
pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm test:e2e
```

`pnpm test` runs the unit tests (Vitest). `pnpm test:e2e` drives the production build in Chrome (Playwright) and checks, among other things, that exported images decode back to the original text.

## Rules

- Conventional Commits in English: `type(scope): summary`, imperative, lower case, up to 50 characters.
- One change per pull request. Add a test with every bug fix.
- No new runtime dependency without a reason in the pull request. The first load budget is 80 KB gzip, font included (`node scripts/size-budget.mjs dist`).
- The page must make no network request after it loads. The content security policy (`connect-src 'none'`) enforces this; do not loosen it.
- Content that can be private (Pix keys, Wi-Fi passwords, contact data) never goes to storage, the URL or a log.

## Translations

Strings live in `src/locales/en.json`, `pt-BR.json` and `es.json`. A test fails when the key sets differ or when a placeholder such as `{n}` is missing.

To add a language:

1. Copy `en.json` to `src/locales/<code>.json` and translate the values.
2. Add the code to `LANGS` and to the loaders in `src/app/i18n.ts`, and add its name (`lang.<code>`) to every locale file.
3. Add the language to the parity test in `tests/locales.test.ts`.

Keep the tone direct. No emoji, no marketing words.

## Where things are

| Path | Purpose |
| --- | --- |
| `src/qr/encoder.ts` | QR encoder (versions 1 to 40). |
| `src/qr/svg.ts`, `style.ts`, `templates.ts` | Styled SVG rendering and frames. |
| `src/payloads/` | Content builders: Pix, Wi-Fi, contact, email and others. |
| `src/verify/` | Read check, suggested fixes, reader analysis. |
| `src/export/` | PNG, PDF, ZIP and CSV helpers. |
| `src/app/` | Interface. |
| `scripts/` | Build helpers, budget checks, cross-check with another decoder. |
| `brand/` | Source files of the mascot, logo and palettes. |
