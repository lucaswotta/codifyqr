import { fail, ok, type PayloadSpec, type Values } from './types';

const val = (v: Values, k: string) => (v[k] ?? '').trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Domain-like input without a scheme, e.g. "example.com/page". */
const SCHEMELESS_URL = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

export const text: PayloadSpec = {
  kind: 'text',
  sensitive: false,
  fields: [{ name: 'content', type: 'textarea', required: true, maxLength: 2000 }],
  build(v) {
    const content = (v.content ?? '').trim();
    if (content === '') return fail({ content: 'required' });
    if (SCHEMELESS_URL.test(content) && !/\s/.test(content)) return ok(`https://${content}`, ['autoHttps']);
    return ok(content);
  },
};

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
const wifiField = (s: string) => (/^[0-9a-f]+$/i.test(s) ? `"${s}"` : wifiEscape(s));

export const wifi: PayloadSpec = {
  kind: 'wifi',
  sensitive: true,
  fields: [
    { name: 'ssid', type: 'text', required: true, maxLength: 32, autocomplete: 'off' },
    { name: 'security', type: 'select', options: ['WPA', 'WEP', 'nopass'], value: 'WPA' },
    { name: 'password', type: 'password', maxLength: 63, autocomplete: 'off' },
    { name: 'hidden', type: 'checkbox' },
  ],
  build(v) {
    const errors: Record<string, string> = {};
    const ssid = v.ssid ?? '';
    const security = v.security === 'WEP' || v.security === 'nopass' ? v.security : 'WPA';
    const password = v.password ?? '';
    if (ssid === '') errors.ssid = 'required';
    if (security !== 'nopass') {
      if (password === '') errors.password = 'required';
      else if (security === 'WPA' && (password.length < 8 || password.length > 63)) errors.password = 'wifiPassword';
    }
    if (Object.keys(errors).length > 0) return fail(errors);
    const parts = [`T:${security}`, `S:${wifiField(ssid)}`];
    if (security !== 'nopass') parts.push(`P:${wifiField(password)}`);
    if (v.hidden === 'true') parts.push('H:true');
    return ok(`WIFI:${parts.join(';')};;`);
  },
};

const vcardEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const vcard: PayloadSpec = {
  kind: 'vcard',
  sensitive: true,
  fields: [
    { name: 'firstName', type: 'text', autocomplete: 'off' },
    { name: 'lastName', type: 'text', autocomplete: 'off' },
    { name: 'org', type: 'text', autocomplete: 'off' },
    { name: 'title', type: 'text', autocomplete: 'off' },
    { name: 'phone', type: 'tel', autocomplete: 'off' },
    { name: 'email', type: 'email', autocomplete: 'off' },
    { name: 'website', type: 'url', autocomplete: 'off' },
    { name: 'street', type: 'text', autocomplete: 'off' },
    { name: 'city', type: 'text', autocomplete: 'off' },
    { name: 'zip', type: 'text', autocomplete: 'off' },
    { name: 'country', type: 'text', autocomplete: 'off' },
  ],
  build(v) {
    const first = val(v, 'firstName');
    const last = val(v, 'lastName');
    const org = val(v, 'org');
    const email = val(v, 'email');
    const errors: Record<string, string> = {};
    if (!first && !last && !org) errors.firstName = 'vcardName';
    if (email && !EMAIL.test(email)) errors.email = 'invalidEmail';
    if (Object.keys(errors).length > 0) return fail(errors);

    const e = vcardEscape;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${e(last)};${e(first)};;;`,
      `FN:${e([first, last].filter(Boolean).join(' ') || org)}`,
    ];
    if (org) lines.push(`ORG:${e(org)}`);
    if (val(v, 'title')) lines.push(`TITLE:${e(val(v, 'title'))}`);
    if (val(v, 'phone')) lines.push(`TEL;TYPE=CELL:${e(val(v, 'phone'))}`);
    if (email) lines.push(`EMAIL:${e(email)}`);
    if (val(v, 'website')) lines.push(`URL:${val(v, 'website')}`);
    if (val(v, 'street') || val(v, 'city') || val(v, 'zip') || val(v, 'country')) {
      lines.push(`ADR:;;${e(val(v, 'street'))};${e(val(v, 'city'))};;${e(val(v, 'zip'))};${e(val(v, 'country'))}`);
    }
    lines.push('END:VCARD');
    return ok(lines.join('\n'));
  },
};

export const email: PayloadSpec = {
  kind: 'email',
  sensitive: false,
  fields: [
    { name: 'to', type: 'email', required: true, autocomplete: 'off' },
    { name: 'subject', type: 'text', autocomplete: 'off' },
    { name: 'body', type: 'textarea', autocomplete: 'off' },
  ],
  build(v) {
    const to = val(v, 'to');
    if (to === '') return fail({ to: 'required' });
    if (!EMAIL.test(to)) return fail({ to: 'invalidEmail' });
    const params: string[] = [];
    if (val(v, 'subject')) params.push(`subject=${encodeURIComponent(val(v, 'subject'))}`);
    if (val(v, 'body')) params.push(`body=${encodeURIComponent(val(v, 'body'))}`);
    return ok(`mailto:${to}${params.length ? `?${params.join('&')}` : ''}`);
  },
};

function phoneDigits(raw: string): string {
  return raw.trim().replace(/^\+/, '').replace(/^00/, '').replace(/\D/g, '');
}

export const sms: PayloadSpec = {
  kind: 'sms',
  sensitive: false,
  fields: [
    { name: 'phone', type: 'tel', required: true, autocomplete: 'off' },
    { name: 'message', type: 'textarea', autocomplete: 'off' },
  ],
  build(v) {
    const digits = phoneDigits(v.phone ?? '');
    if (digits === '') return fail({ phone: 'required' });
    if (digits.length < 8 || digits.length > 15) return fail({ phone: 'invalidPhone' });
    const plus = (v.phone ?? '').trim().startsWith('+') ? '+' : '';
    const body = val(v, 'message');
    return ok(`sms:${plus}${digits}${body ? `?body=${encodeURIComponent(body)}` : ''}`);
  },
};

export const whatsapp: PayloadSpec = {
  kind: 'whatsapp',
  sensitive: false,
  fields: [
    { name: 'phone', type: 'tel', required: true, autocomplete: 'off' },
    { name: 'message', type: 'textarea', autocomplete: 'off' },
  ],
  build(v) {
    const digits = phoneDigits(v.phone ?? '');
    if (digits === '') return fail({ phone: 'required' });
    if (digits.length < 8 || digits.length > 15) return fail({ phone: 'invalidPhone' });
    const body = val(v, 'message');
    return ok(`https://wa.me/${digits}${body ? `?text=${encodeURIComponent(body)}` : ''}`);
  },
};

export const geo: PayloadSpec = {
  kind: 'geo',
  sensitive: false,
  fields: [
    { name: 'lat', type: 'text', required: true, inputMode: 'decimal', autocomplete: 'off' },
    { name: 'lon', type: 'text', required: true, inputMode: 'decimal', autocomplete: 'off' },
  ],
  build(v) {
    const errors: Record<string, string> = {};
    const parse = (k: string, limit: number) => {
      const raw = val(v, k).replace(',', '.');
      if (raw === '') errors[k] = 'required';
      else if (!/^-?\d+(\.\d+)?$/.test(raw) || Math.abs(Number(raw)) > limit) errors[k] = 'geoRange';
      return raw;
    };
    const lat = parse('lat', 90);
    const lon = parse('lon', 180);
    if (Object.keys(errors).length > 0) return fail(errors);
    return ok(`geo:${Number(lat)},${Number(lon)}`);
  },
};

const icsEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function icsDate(local: string, allDay: boolean): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return null;
  return allDay ? `${m[1]}${m[2]}${m[3]}` : `${m[1]}${m[2]}${m[3]}T${m[4] ?? '00'}${m[5] ?? '00'}00`;
}

export const event: PayloadSpec = {
  kind: 'event',
  sensitive: false,
  fields: [
    { name: 'title', type: 'text', required: true, autocomplete: 'off' },
    { name: 'start', type: 'datetime-local', required: true },
    { name: 'end', type: 'datetime-local' },
    { name: 'allDay', type: 'checkbox' },
    { name: 'location', type: 'text', autocomplete: 'off' },
    { name: 'description', type: 'textarea', autocomplete: 'off' },
  ],
  build(v) {
    const errors: Record<string, string> = {};
    const allDay = v.allDay === 'true';
    if (val(v, 'title') === '') errors.title = 'required';
    const start = icsDate(val(v, 'start'), allDay);
    if (!start) errors.start = 'required';
    let end = val(v, 'end') ? icsDate(val(v, 'end'), allDay) : null;
    if (val(v, 'end') && !end) errors.end = 'invalidDate';
    if (start && end && end < start) errors.end = 'eventEnd';
    if (Object.keys(errors).length > 0 || !start) return fail(errors);

    if (allDay && !end) {
      const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8) + 1));
      end = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    } else if (allDay && end) {
      const d = new Date(Date.UTC(+end.slice(0, 4), +end.slice(4, 6) - 1, +end.slice(6, 8) + 1));
      end = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    }

    const stamp = allDay ? 'VALUE=DATE:' : '';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${icsEscape(val(v, 'title'))}`,
      `DTSTART${stamp ? `;${stamp.slice(0, -1)}:` : ':'}${start}`,
    ];
    if (end) lines.push(`DTEND${stamp ? `;${stamp.slice(0, -1)}:` : ':'}${end}`);
    if (val(v, 'location')) lines.push(`LOCATION:${icsEscape(val(v, 'location'))}`);
    if (val(v, 'description')) lines.push(`DESCRIPTION:${icsEscape(val(v, 'description'))}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return ok(lines.join('\n'));
  },
};

export const app: PayloadSpec = {
  kind: 'app',
  sensitive: false,
  fields: [
    { name: 'store', type: 'select', options: ['play', 'ios'], value: 'play' },
    { name: 'id', type: 'text', required: true, autocomplete: 'off' },
  ],
  build(v) {
    const id = val(v, 'id');
    if (id === '') return fail({ id: 'required' });
    if (v.store === 'ios') {
      const digits = id.replace(/^id/i, '');
      return /^\d{6,12}$/.test(digits) ? ok(`https://apps.apple.com/app/id${digits}`) : fail({ id: 'appIos' });
    }
    return /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(id)
      ? ok(`https://play.google.com/store/apps/details?id=${id}`)
      : fail({ id: 'appPlay' });
  },
};
