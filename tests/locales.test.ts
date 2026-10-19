import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../src/locales/en.json';
import es from '../src/locales/es.json';
import pt from '../src/locales/pt-BR.json';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('locales', () => {
  for (const [name, dict] of [
    ['pt-BR', pt],
    ['es', es],
  ] as const) {
    it(`${name} has exactly the English keys`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${name} keeps the same placeholders`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders((dict as Record<string, string>)[key]!), key).toEqual(placeholders(en[key]));
      }
    });
  }

  it('every literal t() key used in the source exists', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (path.endsWith('.ts')) files.push(path);
      }
    };
    walk('src');
    const missing: string[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'/g))
        if (!(m[1]! in en)) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('has no duplicate keys in locale files', () => {
    for (const file of ['src/locales/en.json', 'src/locales/pt-BR.json', 'src/locales/es.json']) {
      const keys = [...readFileSync(file, 'utf8').matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]!);
      expect(keys, file).toHaveLength(new Set(keys).size);
    }
  });
});
