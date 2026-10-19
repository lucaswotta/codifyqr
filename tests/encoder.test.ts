import { describe, expect, it } from 'vitest';
import { byteCapacity, DataTooLongError, ECC_LEVELS, encodeText } from '../src/qr/encoder';
import { decode } from './helpers';

describe('capacity', () => {
  it('matches the published byte-mode limits', () => {
    expect(byteCapacity(1, 'L')).toBe(17);
    expect(byteCapacity(1, 'M')).toBe(14);
    expect(byteCapacity(1, 'Q')).toBe(11);
    expect(byteCapacity(1, 'H')).toBe(7);
    expect(byteCapacity(40, 'L')).toBe(2953);
    expect(byteCapacity(40, 'M')).toBe(2331);
    expect(byteCapacity(40, 'Q')).toBe(1663);
    expect(byteCapacity(40, 'H')).toBe(1273);
  });

  it('rejects data that does not fit in version 40', () => {
    expect(() => encodeText('x'.repeat(1274), { ecc: 'H', boostEcc: false })).toThrow(DataTooLongError);
    expect(encodeText('x'.repeat(1273), { ecc: 'H', boostEcc: false }).version).toBe(40);
  });
});

describe('round trip with an independent decoder', () => {
  it.each(ECC_LEVELS)(
    'decodes text at every version with ecc %s',
    (ecc) => {
      for (let version = 1; version <= 40; version++) {
        // jsQR lists the version 23 alignment centers as 6,30,54,74,102; the standard says 78.
        // Version 23 is covered by the structural test below instead.
        if (version === 23) continue;
        const target = byteCapacity(version, ecc);
        const text = Array.from({ length: target }, (_, i) => String.fromCharCode(97 + ((i * 7 + version) % 26))).join(
          '',
        );
        const matrix = encodeText(text, { ecc, boostEcc: false, minVersion: version, maxVersion: version });
        expect(matrix.version).toBe(version);
        expect(decode(matrix), `version ${version} ecc ${ecc}`).toBe(text);
      }
    },
    120_000,
  );

  it('lays out version 23 with the standard alignment centers', () => {
    const matrix = encodeText('a'.repeat(byteCapacity(23, 'L')), {
      ecc: 'L',
      boostEcc: false,
      minVersion: 23,
      maxVersion: 23,
    });
    // Alignment pattern at (78, 78): dark ring at distance 2, light at distance 1, dark center.
    expect(matrix.get(78, 78)).toBe(true);
    expect(matrix.get(77, 78)).toBe(false);
    expect(matrix.get(76, 78)).toBe(true);
  });

  it('handles numeric, alphanumeric and unicode content', () => {
    for (const text of [
      '0123456789',
      'HELLO WORLD $%*+-./:',
      'https://example.com/a?b=c&d=ç',
      'Pagamento é fácil 日本語',
      'a',
    ]) {
      expect(decode(encodeText(text))).toBe(text);
    }
  });

  it('keeps every mask pattern decodable', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(decode(encodeText('mask test 12345', { mask }))).toBe('mask test 12345');
    }
  });

  it('boosts the ecc level when it does not raise the version', () => {
    const boosted = encodeText('hi', { ecc: 'L' });
    expect(boosted.version).toBe(1);
    expect(boosted.ecc).toBe('H');
    expect(encodeText('hi', { ecc: 'L', boostEcc: false }).ecc).toBe('L');
  });

  it('is deterministic', () => {
    const a = encodeText('same input');
    const b = encodeText('same input');
    expect(Buffer.from(a.modules).equals(Buffer.from(b.modules))).toBe(true);
  });
});
