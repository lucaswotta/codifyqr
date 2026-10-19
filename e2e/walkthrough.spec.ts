import { mkdirSync, readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { PAYLOADS, type PayloadKind, type Values } from '../src/payloads';
import { chip, decodePng, downloadPng, fillContent, openTab } from './helpers';

/** Collects everything that should never happen while a person uses the page. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) problems.push(`console ${m.type()}: ${m.text()}`);
  });
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  return problems;
}

/** Waits past the debounce so the state read afterwards belongs to the latest change. */
async function settled(page: Page): Promise<string> {
  await page.waitForTimeout(600);
  await page.waitForFunction(() => document.querySelector('.verify')?.getAttribute('data-state') !== 'checking');
  return (await page.locator('.verify').getAttribute('data-state')) ?? '';
}

async function noPageScroll(page: Page, label: string): Promise<void> {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    iw: innerWidth,
    ih: innerHeight,
  }));
  expect.soft(size.sw, `${label}: page width`).toBe(size.iw);
  expect.soft(size.sh, `${label}: page height`).toBe(size.ih);
}

async function fillFields(page: Page, kind: PayloadKind, values: Values): Promise<void> {
  // The form remembers what was typed before, so fields this case leaves out are cleared first.
  const wanted: Values = { ...values };
  for (const field of PAYLOADS[kind].fields) {
    if (!(field.name in wanted) && field.name !== 'start' && field.name !== 'end') {
      wanted[field.name] = field.type === 'checkbox' ? 'false' : (field.value ?? '');
    }
  }
  for (const [name, value] of Object.entries(wanted)) {
    const locator = page.locator(`#f-${kind}-${name}`);
    const tag = await locator.evaluate((el) => `${el.tagName}:${(el as HTMLInputElement).type}`);
    if (tag.endsWith('checkbox')) {
      if (value === 'true') await locator.check();
      else await locator.uncheck();
    } else if (tag.startsWith('SELECT')) await locator.selectOption(value);
    else await locator.fill(value);
  }
}

const KINDS: { kind: PayloadKind; label: string; values: Values }[] = [
  { kind: 'text', label: 'Link or text', values: { content: 'https://example.com/path?query=1&x=é' } },
  { kind: 'text', label: 'Link or text', values: { content: 'Plain text with accents: ação, ñ, ü and emoji 🙂' } },
  { kind: 'text', label: 'Link or text', values: { content: 'example.com/short' } },
  {
    kind: 'pix',
    label: 'Pix',
    values: {
      key: '529.982.247-25',
      name: 'Ana Conceição',
      city: 'São Paulo',
      amount: '1.234,50',
      message: 'Pedido 42',
      txid: 'PED42',
    },
  },
  { kind: 'pix', label: 'Pix', values: { key: 'ana@example.com', name: 'Ana', city: '' } },
  {
    kind: 'pix',
    label: 'Pix',
    values: { key: '+55 (11) 91234-5678', name: 'Loja do Zé', city: 'Recife', amount: '10' },
  },
  {
    kind: 'pix',
    label: 'Pix',
    values: { key: '123e4567-e12b-12d1-a456-426655440000', name: 'Random Key', city: 'Brasilia' },
  },
  {
    kind: 'pix',
    label: 'Pix',
    values: { key: '11.222.333/0001-81', name: 'Empresa LTDA', city: 'Curitiba', amount: '99,99' },
  },
  {
    kind: 'wifi',
    label: 'Wi-Fi',
    values: { ssid: 'Café Bar', security: 'WPA', password: 's3nha;forte,1', hidden: 'true' },
  },
  { kind: 'wifi', label: 'Wi-Fi', values: { ssid: 'Old Router', security: 'WEP', password: '12345' } },
  { kind: 'wifi', label: 'Wi-Fi', values: { ssid: 'Guests', security: 'nopass', password: '' } },
  {
    kind: 'vcard',
    label: 'Contact',
    values: {
      firstName: 'Ana',
      lastName: 'Silva, Jr',
      org: 'Studio; Co',
      title: 'Designer',
      phone: '+55 11 91234-5678',
      email: 'ana@example.com',
      website: 'https://ana.example.com',
      street: 'Rua A, 10',
      city: 'São Paulo',
      zip: '01000-000',
      country: 'Brasil',
    },
  },
  {
    kind: 'email',
    label: 'Email',
    values: { to: 'ana@example.com', subject: 'Olá & tchau', body: 'Linha 1\nLinha 2' },
  },
  { kind: 'sms', label: 'SMS', values: { phone: '+55 11 91234-5678', message: 'Oi, tudo bem?' } },
  { kind: 'whatsapp', label: 'WhatsApp', values: { phone: '+55 11 91234-5678', message: 'Quero o cardápio' } },
  { kind: 'geo', label: 'Location', values: { lat: '-23,5505', lon: '-46.6333' } },
  {
    kind: 'event',
    label: 'Event',
    values: {
      title: 'Launch, party',
      start: '2026-11-05T09:00',
      end: '2026-11-05T10:30',
      location: 'Rua A',
      description: 'Bring friends; snacks',
    },
  },
  { kind: 'event', label: 'Event', values: { title: 'Holiday', allDay: 'true', start: '2026-12-24', end: '' } },
  { kind: 'app', label: 'App store', values: { store: 'play', id: 'com.example.app' } },
  { kind: 'app', label: 'App store', values: { store: 'ios', id: '123456789' } },
];

test('every content type: fields, preview, read check and the exported PNG', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  for (const [index, { kind, label, values }] of KINDS.entries()) {
    await test.step(`${kind} #${index + 1}`, async () => {
      await chip(page, label).click();
      await fillFields(page, kind, values);
      const built = PAYLOADS[kind].build(values);
      expect.soft(built.ok, `${kind} ${JSON.stringify(values)} should build`).toBe(true);
      if (!built.ok) return;
      await expect(page.locator('.qr-img')).toBeVisible();
      await expect(page.locator('.verify')).toHaveAttribute('data-state', /ok|risk/);
      const state = await page.locator('.verify').getAttribute('data-state');
      expect.soft(state, `${kind} #${index + 1} read check`).toBe('ok');
      const decoded = await decodePng(page, await downloadPng(page));
      expect.soft(decoded, `${kind} #${index + 1} decoded text`).toBe(built.text);
      await noPageScroll(page, `${kind} #${index + 1}`);
    });
  }
  expect(problems).toEqual([]);
});

test('validation messages show for wrong input and clear when fixed', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  const cases: { kind: PayloadKind; label: string; values: Values; field: string; message: RegExp; fix: string }[] = [
    {
      kind: 'pix',
      label: 'Pix',
      values: { key: '000', name: 'A' },
      field: 'key',
      message: /Not a valid Pix key/,
      fix: 'ana@example.com',
    },
    {
      kind: 'pix',
      label: 'Pix',
      values: { key: 'ana@example.com', name: 'A', amount: '-3' },
      field: 'amount',
      message: /positive amount/,
      fix: '5,00',
    },
    {
      kind: 'pix',
      label: 'Pix',
      values: { key: 'ana@example.com', name: 'A', txid: 'bad id!' },
      field: 'txid',
      message: /Letters and numbers/,
      fix: 'OK1',
    },
    {
      kind: 'wifi',
      label: 'Wi-Fi',
      values: { ssid: 'X', password: 'short' },
      field: 'password',
      message: /8 to 63/,
      fix: 'long enough pass',
    },
    { kind: 'email', label: 'Email', values: { to: 'nope' }, field: 'to', message: /valid email/, fix: 'a@b.co' },
    {
      kind: 'sms',
      label: 'SMS',
      values: { phone: '12' },
      field: 'phone',
      message: /country code/,
      fix: '+55 11 91234-5678',
    },
    { kind: 'geo', label: 'Location', values: { lat: '95', lon: '0' }, field: 'lat', message: /-90 to 90/, fix: '10' },
    {
      kind: 'app',
      label: 'App store',
      values: { store: 'ios', id: 'abc' },
      field: 'id',
      message: /numeric App Store ID/,
      fix: '123456789',
    },
  ];
  for (const c of cases) {
    await chip(page, c.label).click();
    await fillFields(page, c.kind, c.values);
    const input = page.locator(`#f-${c.kind}-${c.field}`);
    await input.blur();
    await expect.soft(page.locator(`#f-${c.kind}-${c.field}-err`), `${c.kind}.${c.field}`).toContainText(c.message);
    await input.fill(c.fix);
    await expect.soft(page.locator(`#f-${c.kind}-${c.field}-err`)).toBeHidden();
  }
  expect(problems).toEqual([]);
});

test('every control of the style panel, sliders included', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await fillContent(page, 'https://example.com/controls?id=12345');
  await openTab(page, 'Style');

  await test.step('presets', async () => {
    for (const preset of ['ink', 'press', 'ocean', 'clay', 'violet']) {
      await page.locator(`[data-preset="${preset}"]`).click();
      await expect(page.locator('.verify')).toHaveAttribute('data-state', /ok|risk|fail/);
      const decoded = await decodePng(page, await downloadPng(page));
      expect.soft(decoded, `preset ${preset}`).toBe('https://example.com/controls?id=12345');
    }
  });

  await test.step('colors, transparency, gradient and eye color', async () => {
    await page.locator('#c-fg').fill('#112233');
    await page.locator('#c-bg').fill('#fff7e0');
    await page.locator('#c-transparent').check();
    await expect(page.locator('.qr-img')).toBeVisible();
    await page.locator('#c-transparent').uncheck();
    for (const g of ['Linear', 'Radial', 'None']) {
      await chip(page, g).click();
      if (g !== 'None') await expect(page.locator('#c-fg2')).toBeVisible();
    }
    await chip(page, 'Linear').click();
    await page.locator('#c-fg2').fill('#aa3300');
    await page.locator('#c-eye').fill('#003366');
    await page.getByRole('button', { name: 'Same as code' }).click();
    await expect(page.getByRole('button', { name: 'Same as code' })).toBeHidden();
    expect.soft(await decodePng(page, await downloadPng(page))).toBe('https://example.com/controls?id=12345');
  });

  await test.step('gradient angle slider: keyboard, mouse drag and bounds', async () => {
    const angle = page.locator('#r-angle');
    for (const value of ['0', '45', '180', '360']) {
      await angle.fill(value);
      await expect(angle).toHaveValue(value);
    }
    const box = (await angle.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + box.height / 2);
    const low = Number(await angle.inputValue());
    await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
    const high = Number(await angle.inputValue());
    expect.soft(low, 'slider left end').toBeLessThanOrEqual(30);
    expect.soft(high, 'slider right end').toBeGreaterThanOrEqual(330);
    await angle.focus();
    await page.keyboard.press('ArrowLeft');
    expect.soft(Number(await angle.inputValue())).toBeLessThan(high);
    expect.soft(await decodePng(page, await downloadPng(page))).toBe('https://example.com/controls?id=12345');
  });

  await test.step('border slider from 0 to 8 and what the read check says', async () => {
    const margin = page.locator('#r-margin');
    const seen: Record<string, string> = {};
    for (const value of ['0', '1', '2', '4', '8']) {
      await margin.fill(value);
      await expect(margin).toHaveValue(value);
      seen[value] = await settled(page);
    }
    expect.soft(seen['4'], 'border 4 is the standard').toBe('ok');
    expect.soft(seen['8']).toBe('ok');
    expect.soft(['risk', 'fail']).toContain(seen['0']);
    const box = (await margin.boundingBox())!;
    await page.mouse.click(box.x + 3, box.y + box.height / 2);
    expect.soft(await margin.inputValue()).toBe('0');
    await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
    expect.soft(await margin.inputValue()).toBe('8');
    await margin.fill('4');
  });

  await test.step('error correction chips', async () => {
    for (const level of ['Automatic', 'L \\(7%\\)', 'M \\(15%\\)', 'Q \\(25%\\)', 'H \\(30%\\)']) {
      await chip(page, level).click();
      await expect(page.locator('.qr-img')).toBeVisible();
      expect
        .soft(await decodePng(page, await downloadPng(page)), `ecc ${level}`)
        .toBe('https://example.com/controls?id=12345');
    }
    await chip(page, 'Automatic').click();
  });

  await test.step('logo: upload, size slider over its whole range, replace, remove', async () => {
    await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
    const size = page.locator('#r-logo');
    await expect(size).toBeVisible();
    const min = await size.getAttribute('min');
    const max = await size.getAttribute('max');
    for (const value of [min!, '0.2', '0.26', max!]) {
      await size.fill(value);
      const state = await settled(page);
      expect.soft(['ok', 'risk'], `logo ${value} -> ${state}`).toContain(state);
      expect
        .soft(await decodePng(page, await downloadPng(page)), `logo ${value} decode`)
        .toBe('https://example.com/controls?id=12345');
    }
    const box = (await size.boundingBox())!;
    await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
    await page.locator('#logo-file').setInputFiles('e2e/fixtures/logo.png');
    await page.getByRole('button', { name: 'Remove logo' }).click();
    await expect(page.locator('#r-logo')).toHaveCount(0);
    await page
      .locator('#logo-file')
      .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await expect(page.locator('.toast-error')).toContainText('Could not read that image');
  });

  await test.step('saved styles: save, load, delete, export, import, link', async () => {
    await page.locator('#style-name').fill('Walkthrough');
    await page.getByRole('button', { name: 'Save current style' }).click();
    await expect(page.getByText('Walkthrough')).toBeVisible();
    await chip(page, 'Dots').first().click();
    await page.getByRole('button', { name: 'Load' }).first().click();
    await expect(page.locator('input#shape-dots')).not.toBeChecked();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export file' }).click(),
    ]);
    const json = readFileSync(await download.path(), 'utf8');
    expect.soft(JSON.parse(json).codifyqr).toBe(1);
    await page
      .locator('#style-import')
      .setInputFiles({ name: 's.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await page
      .locator('#style-import')
      .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
    await expect(page.locator('.toast-error', { hasText: 'not a CodifyQR style' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByText('Walkthrough')).toHaveCount(0);
  });

  await noPageScroll(page, 'style panel');
  expect(problems).toEqual([]);
});

test('frames with long, empty and unusual texts, then every export button', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await fillContent(page, 'https://example.com/frames');
  await openTab(page, 'Frame');
  const texts: [string, string][] = [
    [
      'A very long headline that must shrink or wrap without overflowing the template at all',
      'Second line is long too, much longer than the space available in the card',
    ],
    ['', ''],
    ['Café & Pão <b>x</b> "quotes"', "It's 100% fine"],
    ['日本語のテキスト', 'Ελληνικά'],
  ];
  for (const frame of ['Sticker', 'Business card', 'Table card', 'Wi-Fi sign', 'Pix payment']) {
    await chip(page, frame).click();
    for (const [headline, subline] of texts) {
      await page.locator('#frame-headline').fill(headline);
      await page.locator('#frame-subline').fill(subline);
      await page.locator('#frame-footnote').fill('small print');
      await expect(page.locator('.qr-img')).toBeVisible();
      expect
        .soft(await decodePng(page, await downloadPng(page)), `${frame} / ${headline.slice(0, 10)}`)
        .toBe('https://example.com/frames');
    }
  }
  await noPageScroll(page, 'frames');
  expect(problems).toEqual([]);
});

test('PNG sizes, SVG, PDF papers, copy and the dialogs', async ({ page, context }) => {
  const problems = watch(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await fillContent(page, 'https://example.com/exports');

  for (const size of [512, 1024, 2048, 4096]) {
    await page.locator(`label[for="png-size-${size}"]`).click();
    const png = await downloadPng(page);
    expect.soft(png.subarray(1, 4).toString(), `PNG ${size} signature`).toBe('PNG');
    expect.soft(png.readUInt32BE(16), `PNG ${size} width`).toBe(size);
    expect.soft(png.readUInt32BE(20), `PNG ${size} height`).toBe(size);
  }

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'SVG', exact: true }).click(),
  ]);
  const svg = readFileSync(await svgDownload.path(), 'utf8');
  expect.soft(svg).toMatch(/^<\?xml/);
  expect.soft(svg).toContain('viewBox=');

  await page.getByRole('button', { name: 'Copy image' }).click();
  await expect(page.locator('.toast', { hasText: 'Image copied' })).toBeVisible();
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0]!.getType('image/png');
    return blob.size;
  });
  expect.soft(copied).toBeGreaterThan(1000);

  for (const paper of ['natural', 'A4', 'A5', 'A6']) {
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await page.locator('#pdf-paper').selectOption(paper);
    for (const cm of ['1', '3', '8', '20']) {
      await page.locator('#pdf-qr').fill(cm);
      const warn = page.getByText('Modules under 0.4 mm');
      if (cm === '1') await expect.soft(warn).toBeVisible();
      else await expect.soft(warn).toBeHidden();
    }
    await page.locator('#pdf-qr').fill('6');
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Create PDF' }).click(),
    ]);
    const bytes = readFileSync(await pdf.path());
    expect.soft(bytes.subarray(0, 8).toString(), `PDF ${paper}`).toBe('%PDF-1.4');
    expect.soft(bytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.keyboard.press('Shift+?');
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.keyboard.press('h');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await noPageScroll(page, 'exports');
  expect(problems).toEqual([]);
});

test('too much, empty and odd content', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  const field = page.locator('#f-text-content');
  await field.fill('   ');
  await expect(page.locator('.stage-empty')).toBeVisible();
  await field.fill('x'.repeat(1273));
  await expect(page.locator('.verify')).toHaveAttribute('data-state', /ok|risk|fail/);
  expect.soft(await decodePng(page, await downloadPng(page))).toBe('x'.repeat(1273));
  await field.fill('é'.repeat(1200));
  await expect(page.locator('.stage-error')).toContainText('too long');
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  await expect(page.locator('.toast-error')).toContainText('Fill in the content');
  await field.fill('0123456789'.repeat(100));
  expect.soft(await decodePng(page, await downloadPng(page))).toBe('0123456789'.repeat(100));
  await field.fill('HELLO WORLD 123 $%*+-./:');
  expect.soft(await decodePng(page, await downloadPng(page))).toBe('HELLO WORLD 123 $%*+-./:');
  await field.fill('line one\nline two\n\ttabbed');
  expect.soft(await decodePng(page, await downloadPng(page))).toBe('line one\nline two\n\ttabbed');
  expect(problems).toEqual([]);
});

test('batch: pasted lines, a CSV with quotes, the 500 row limit and invalid rows', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await page.getByRole('tab', { name: 'Batch' }).click();
  await page
    .locator('#batch-input')
    .fill(Array.from({ length: 30 }, (_, i) => `https://example.com/item/${i},item ${i}`).join('\n'));
  await expect(page.getByText('30 codes')).toBeVisible();
  await expect(page.locator('.rows .row')).toHaveCount(30);
  await page.locator('label[for="batch-size-512"]').click();
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Create ZIP' }).click(),
  ]);
  expect
    .soft(
      readFileSync(await zip.path())
        .subarray(0, 2)
        .toString(),
    )
    .toBe('PK');
  await expect(page.locator('.rows .row[data-state="ok"]')).toHaveCount(30);

  await page.locator('#batch-input').fill(Array.from({ length: 520 }, (_, i) => `n${i}.example.com`).join('\n'));
  await expect(page.getByText('Only the first 500 rows')).toBeVisible();
  await expect(page.locator('.rows .row')).toHaveCount(500);

  await page.locator('#batch-input').fill('https://ok.example.com,ok\n,\n"a,b",quoted');
  await expect(page.getByText('2 codes')).toBeVisible();
  await page.locator('#batch-input').fill('');
  await page.getByRole('button', { name: 'Create ZIP' }).click();
  await expect(page.locator('.toast-error')).toContainText('Add at least one line');
  await noPageScroll(page, 'batch');
  expect(problems).toEqual([]);
});

test('language, theme and tab bar on desktop and on a phone', async ({ browser }) => {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['tablet', { width: 768, height: 1024 }],
    ['phone', { width: 390, height: 844 }],
    ['small phone', { width: 360, height: 640 }],
  ] as const) {
    const context = await browser.newContext({ viewport, locale: 'en-US' });
    const page = await context.newPage();
    const problems = watch(page);
    await page.goto('./');
    await fillContent(page, 'https://example.com/responsive');
    for (const lang of ['PT', 'ES', 'EN']) {
      await page.locator('.menu-btn').click();
      await page.locator('.menu-item', { hasText: new RegExp(`^${lang}`) }).click();
      await noPageScroll(page, `${name} ${lang}`);
    }
    for (let i = 0; i < 3; i++) {
      await page.locator('.icon-btn[aria-label^="Theme"]').click();
      await noPageScroll(page, `${name} theme ${i}`);
    }
    if (viewport.width <= 860) {
      for (const nav of ['type', 'content', 'style', 'frame', 'export']) {
        await page.locator(`[data-nav="${nav}"]`).click();
        await noPageScroll(page, `${name} panel ${nav}`);
        const visible = await page
          .locator('.col-controls, .col-side')
          .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).length);
        expect.soft(visible, `${name} ${nav} shows a column`).toBeGreaterThan(0);
      }
      await page.locator('[data-nav="style"]').click();
      const margin = page.locator('#r-margin');
      await margin.scrollIntoViewIfNeeded();
      const box = (await margin.boundingBox())!;
      expect.soft(box.width, `${name} slider usable`).toBeGreaterThan(80);
      await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
      expect.soft(await margin.inputValue()).toBe('8');
    }
    for (const mode of ['Batch', 'Scan', 'Create']) {
      await page.getByRole('tab', { name: mode }).click();
      await noPageScroll(page, `${name} ${mode}`);
    }
    expect.soft(problems, name).toEqual([]);
    await context.close();
  }
});

test('screens for a visual check', async ({ page }) => {
  mkdirSync('test-results/walkthrough', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await fillContent(page, 'https://example.com/screens');
  await openTab(page, 'Style');
  await page.screenshot({ path: 'test-results/walkthrough/style.png' });
});
