export type ScanKind = 'url' | 'pix' | 'wifi' | 'vcard' | 'email' | 'sms' | 'geo' | 'event' | 'text';
export type WarnId = 'shortener' | 'punycode' | 'ip' | 'http' | 'script' | 'data' | 'credentials';

export interface ScanAnalysis {
  kind: ScanKind;
  warnings: WarnId[];
  /** Set only for http(s) links, the only thing the reader offers to open. */
  url: string | null;
}

const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'is.gd',
  'ow.ly',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'v.gd',
  't.ly',
  'lnkd.in',
  'bl.ink',
  'shorte.st',
  'adf.ly',
]);

export function analyzeScan(raw: string): ScanAnalysis {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const warnings: WarnId[] = [];

  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:'))
    return { kind: 'text', warnings: ['script'], url: null };
  if (lower.startsWith('data:')) return { kind: 'text', warnings: ['data'], url: null };

  if (/^https?:\/\//i.test(text)) {
    let url: URL | null = null;
    try {
      url = new URL(text);
    } catch {
      return { kind: 'text', warnings: [], url: null };
    }
    const host = url.hostname.toLowerCase();
    if (host.split('.').some((label) => label.startsWith('xn--')) || /\P{ASCII}/u.test(text.split('/')[2] ?? ''))
      warnings.push('punycode');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) warnings.push('ip');
    if (SHORTENERS.has(host.replace(/^www\./, ''))) warnings.push('shortener');
    if (url.protocol === 'http:') warnings.push('http');
    if (url.username !== '' || url.password !== '') warnings.push('credentials');
    return { kind: 'url', warnings, url: url.href };
  }

  if (lower.startsWith('wifi:')) return { kind: 'wifi', warnings, url: null };
  if (lower.startsWith('begin:vcard')) return { kind: 'vcard', warnings, url: null };
  if (lower.startsWith('begin:vcalendar') || lower.startsWith('begin:vevent'))
    return { kind: 'event', warnings, url: null };
  if (lower.startsWith('mailto:') || lower.startsWith('matmsg:')) return { kind: 'email', warnings, url: null };
  if (lower.startsWith('sms:') || lower.startsWith('smsto:')) return { kind: 'sms', warnings, url: null };
  if (lower.startsWith('geo:')) return { kind: 'geo', warnings, url: null };
  if (text.startsWith('000201') && lower.includes('br.gov.bcb.pix')) return { kind: 'pix', warnings, url: null };
  return { kind: 'text', warnings, url: null };
}
