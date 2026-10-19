import { describe, expect, it } from 'vitest';
import { PAYLOADS } from '../src/payloads';
import { classifyPixKey, crc16, pixPayload } from '../src/payloads/pix';

const build = (kind: keyof typeof PAYLOADS, values: Record<string, string>) => PAYLOADS[kind].build(values);

describe('pix', () => {
  it('computes CRC16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('matches the CRC of the sample payload in the BCB manual', () => {
    const sample =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(sample)).toBe('1D3D');
  });

  it('marks the payload as static and ends with a valid CRC', () => {
    const payload = pixPayload({ key: 'a@b.co', name: 'X', city: 'Y' });
    expect(payload.startsWith('000201010211')).toBe(true);
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('classifies keys', () => {
    expect(classifyPixKey('529.982.247-25')).toEqual({ type: 'cpf', key: '52998224725' });
    expect(classifyPixKey('11.222.333/0001-81')).toEqual({ type: 'cnpj', key: '11222333000181' });
    expect(classifyPixKey('(11) 91234-5678')).toEqual({ type: 'phone', key: '+5511912345678' });
    expect(classifyPixKey('Ana@Example.com')).toEqual({ type: 'email', key: 'ana@example.com' });
    expect(classifyPixKey('123E4567-E12B-12D1-A456-426655440000')?.type).toBe('random');
    expect(classifyPixKey('529.982.247-26')).toBeNull();
    expect(classifyPixKey('11.222.333/0001-82')).toBeNull();
    // Without punctuation an invalid CPF is ambiguous with a mobile number and is read as a phone.
    expect(classifyPixKey('52998224726')?.type).toBe('phone');
    expect(classifyPixKey('')).toBeNull();
  });

  it('accepts the alphanumeric CNPJ', () => {
    // 12 chars + two check digits computed with value = charCode - 48
    expect(classifyPixKey('12.ABC.345/01DE-35')?.type).toBe('cnpj');
    expect(classifyPixKey('12.ABC.345/01DE-36')).toBeNull();
  });

  it('normalizes name and city and formats the amount', () => {
    const result = build('pix', {
      key: 'ana@example.com',
      name: 'Ana Conceição',
      city: 'São Paulo',
      amount: '1.234,5',
      txid: '',
      message: 'Pedido #1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('5913ANA CONCEICAO');
    expect(result.text).toContain('6009SAO PAULO');
    expect(result.text).toContain('54071234.50');
    expect(result.text.slice(-4)).toBe(crc16(result.text.slice(0, -4)));
  });

  it('reports field errors without leaking values', () => {
    const result = build('pix', { key: 'nope', name: '', city: 'X', amount: '-3' });
    expect(result).toEqual({ ok: false, errors: { key: 'pixKey', name: 'required', amount: 'pixAmount' } });
  });
});

describe('wifi', () => {
  it('escapes special characters and quotes hex looking values', () => {
    const bs = String.fromCharCode(92);
    const r = build('wifi', { ssid: 'Casa;1', security: 'WPA', password: `p:a;ss,word${bs}1` });
    expect(r).toMatchObject({ ok: true, text: `WIFI:T:WPA;S:Casa${bs};1;P:p${bs}:a${bs};ss${bs},word${bs}${bs}1;;` });
    const hex = build('wifi', { ssid: 'ABCD', security: 'WPA', password: '12345678' });
    expect(hex).toMatchObject({ text: 'WIFI:T:WPA;S:"ABCD";P:"12345678";;' });
  });

  it('supports open and hidden networks and validates passwords', () => {
    expect(build('wifi', { ssid: 'Cafe Bar', security: 'nopass', password: '', hidden: 'true' })).toMatchObject({
      text: 'WIFI:T:nopass;S:Cafe Bar;H:true;;',
    });
    expect(build('wifi', { ssid: 'Cafe Bar', security: 'WPA', password: 'short' })).toEqual({
      ok: false,
      errors: { password: 'wifiPassword' },
    });
  });
});

describe('other formats', () => {
  it('builds text and prefixes bare domains with https', () => {
    expect(build('text', { content: 'example.com/a' })).toMatchObject({
      text: 'https://example.com/a',
      notes: ['autoHttps'],
    });
    expect(build('text', { content: 'hello world' })).toMatchObject({ text: 'hello world', notes: [] });
    expect(build('text', { content: '  ' })).toMatchObject({ ok: false });
  });

  it('builds vCard 3.0 with escaping', () => {
    const r = build('vcard', { firstName: 'Ana', lastName: 'Silva, Jr', phone: '+55 11 91234-5678', email: 'a@b.co' });
    expect(r).toMatchObject({ ok: true });
    if (r.ok)
      expect(r.text.split('\n')).toEqual([
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:Silva\\, Jr;Ana;;;',
        'FN:Ana Silva\\, Jr',
        'TEL;TYPE=CELL:+55 11 91234-5678',
        'EMAIL:a@b.co',
        'END:VCARD',
      ]);
  });

  it('builds mailto, sms, whatsapp and geo', () => {
    expect(build('email', { to: 'a@b.co', subject: 'Olá & tchau', body: 'x y' })).toMatchObject({
      text: 'mailto:a@b.co?subject=Ol%C3%A1%20%26%20tchau&body=x%20y',
    });
    expect(build('sms', { phone: '+55 (11) 91234-5678', message: 'oi' })).toMatchObject({
      text: 'sms:+5511912345678?body=oi',
    });
    expect(build('whatsapp', { phone: '+55 11 91234-5678', message: 'oi tudo' })).toMatchObject({
      text: 'https://wa.me/5511912345678?text=oi%20tudo',
    });
    expect(build('geo', { lat: '-23,5505', lon: '-46.6333' })).toMatchObject({ text: 'geo:-23.5505,-46.6333' });
    expect(build('geo', { lat: '91', lon: '0' })).toEqual({ ok: false, errors: { lat: 'geoRange' } });
  });

  it('builds events and all-day events', () => {
    const timed = build('event', { title: 'Reunião, geral', start: '2026-11-05T09:00', end: '2026-11-05T10:30' });
    expect(timed).toMatchObject({ ok: true });
    if (timed.ok) expect(timed.text).toContain('DTSTART:20261105T090000\nDTEND:20261105T103000');
    const allDay = build('event', { title: 'Feriado', start: '2026-12-24', allDay: 'true' });
    if (allDay.ok) expect(allDay.text).toContain('DTSTART;VALUE=DATE:20261224\nDTEND;VALUE=DATE:20261225');
    expect(build('event', { title: 'x', start: '2026-11-05T10:00', end: '2026-11-05T09:00' })).toEqual({
      ok: false,
      errors: { end: 'eventEnd' },
    });
  });

  it('builds store links', () => {
    expect(build('app', { store: 'play', id: 'com.example.app' })).toMatchObject({
      text: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    expect(build('app', { store: 'ios', id: 'id123456789' })).toMatchObject({
      text: 'https://apps.apple.com/app/id123456789',
    });
    expect(build('app', { store: 'ios', id: 'abc' })).toEqual({ ok: false, errors: { id: 'appIos' } });
  });
});
