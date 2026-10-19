import { describe, expect, it } from 'vitest';
import { analyzeScan } from '../src/verify/scan';

describe('analyzeScan', () => {
  it('detects content types', () => {
    expect(analyzeScan('https://example.com/a').kind).toBe('url');
    expect(analyzeScan('WIFI:T:WPA;S:x;P:y;;').kind).toBe('wifi');
    expect(analyzeScan('BEGIN:VCARD\nVERSION:3.0').kind).toBe('vcard');
    expect(analyzeScan('mailto:a@b.co').kind).toBe('email');
    expect(analyzeScan('geo:1,2').kind).toBe('geo');
    expect(analyzeScan('00020101021126580014br.gov.bcb.pix0136x').kind).toBe('pix');
    expect(analyzeScan('hello').kind).toBe('text');
  });

  it('opens nothing but http(s) links', () => {
    expect(analyzeScan('https://example.com').url).toBe('https://example.com/');
    expect(analyzeScan('javascript:alert(1)')).toEqual({ kind: 'text', warnings: ['script'], url: null });
    expect(analyzeScan('data:text/html;base64,AAAA')).toEqual({ kind: 'text', warnings: ['data'], url: null });
    expect(analyzeScan('mailto:a@b.co').url).toBeNull();
  });

  it('warns about risky links', () => {
    expect(analyzeScan('https://bit.ly/3abc').warnings).toEqual(['shortener']);
    expect(analyzeScan('http://example.com').warnings).toEqual(['http']);
    expect(analyzeScan('https://192.168.0.1/login').warnings).toEqual(['ip']);
    expect(analyzeScan('https://xn--pple-43d.com').warnings).toEqual(['punycode']);
    expect(analyzeScan('https://аpple.com').warnings).toContain('punycode');
    expect(analyzeScan('https://paypal.com@evil.example/x').warnings).toEqual(['credentials']);
    expect(analyzeScan('https://example.com/ok').warnings).toEqual([]);
  });
});
