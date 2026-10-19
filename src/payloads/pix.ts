import { fail, ok, type PayloadSpec, type Values } from './types';

export interface PixInput {
  key: string;
  name: string;
  city: string;
  amount?: string;
  txid?: string;
  message?: string;
}

const tlv = (id: string, value: string): string => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16/CCITT-FALSE as required by the BR Code specification. */
export function crc16(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Builds the static Pix payload without normalizing anything. */
export function pixPayload({ key, name, city, amount, txid, message }: PixInput): string {
  const account = tlv('00', 'br.gov.bcb.pix') + tlv('01', key) + (message ? tlv('02', message) : '');
  const body =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', account) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount ? tlv('54', amount) : '') +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', city) +
    tlv('62', tlv('05', txid || '***')) +
    '6304';
  return body + crc16(body);
}

function cpfValid(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(digits[len])) return false;
  }
  return true;
}

/** Accepts the numeric and the alphanumeric CNPJ (valid since 2026). */
function cnpjValid(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(.)\1{13}$/.test(value)) return false;
  const code = (c: string) => c.charCodeAt(0) - 48;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += code(value[i]!) * weights[i]!;
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return check(12) === Number(value[12]) && check(13) === Number(value[13]);
}

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';

/** Normalizes a user typed key and tells which kind it is, or null when it is not a valid key. */
export function classifyPixKey(raw: string): { type: PixKeyType; key: string } | null {
  const input = raw.trim();
  if (input === '') return null;
  if (input.includes('@')) {
    const email = input.toLowerCase();
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) && email.length <= 77
      ? { type: 'email', key: email }
      : null;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    return { type: 'random', key: input.toLowerCase() };
  }
  if (input.startsWith('+')) {
    const phone = `+${input.replace(/\D/g, '')}`;
    return /^\+55\d{10,11}$/.test(phone) ? { type: 'phone', key: phone } : null;
  }
  const compact = input.replace(/[.\-/\s()]/g, '').toUpperCase();
  if (cpfValid(compact)) return { type: 'cpf', key: compact };
  if (cnpjValid(compact)) return { type: 'cnpj', key: compact };
  // Punctuated like a CPF or CNPJ but failing the check digits: a typo, never a phone number.
  if (
    /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(input) ||
    /^[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-\d{2}$/.test(input)
  )
    return null;
  if (/^\d{10,11}$/.test(compact)) return { type: 'phone', key: `+55${compact}` };
  return null;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');
const cleanLabel = (s: string) =>
  stripAccents(s)
    .replace(/[^A-Za-z0-9 .,'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const PIX_NAME_MAX = 25;
export const PIX_CITY_MAX = 15;
export const PIX_DEFAULT_CITY = 'BRASIL';

export const pix: PayloadSpec = {
  kind: 'pix',
  sensitive: true,
  fields: [
    { name: 'key', type: 'text', required: true, autocomplete: 'off', maxLength: 77 },
    { name: 'name', type: 'text', required: true, maxLength: PIX_NAME_MAX, autocomplete: 'off' },
    { name: 'city', type: 'text', maxLength: PIX_CITY_MAX, autocomplete: 'off' },
    { name: 'amount', type: 'text', inputMode: 'decimal', autocomplete: 'off' },
    { name: 'message', type: 'text', maxLength: 60, autocomplete: 'off' },
    { name: 'txid', type: 'text', maxLength: 25, autocomplete: 'off' },
  ],
  build(v: Values) {
    const errors: Record<string, string> = {};
    const notes: string[] = [];

    const key = classifyPixKey(v.key ?? '');
    if (!key) errors.key = (v.key ?? '').trim() === '' ? 'required' : 'pixKey';
    else notes.push(`pixKeyType:${key.type}`);

    const name = cleanLabel(v.name ?? '')
      .slice(0, PIX_NAME_MAX)
      .trim();
    if (!name) errors.name = 'required';
    // The standard requires a city, but nobody validates it, so an empty field becomes a neutral value.
    const city =
      cleanLabel(v.city ?? '')
        .slice(0, PIX_CITY_MAX)
        .trim() || PIX_DEFAULT_CITY;

    let amount: string | undefined;
    const rawAmount = (v.amount ?? '').trim().replace(/^R\$\s*/i, '');
    if (rawAmount !== '') {
      const normalized = rawAmount.includes(',') ? rawAmount.replace(/\./g, '').replace(',', '.') : rawAmount;
      const n = Number(normalized);
      if (!/^\d+(\.\d{1,2})?$/.test(normalized) || !(n > 0) || n > 9_999_999_999.99) errors.amount = 'pixAmount';
      else amount = n.toFixed(2);
    }

    const txid = (v.txid ?? '').trim();
    if (txid !== '' && !/^[A-Za-z0-9]{1,25}$/.test(txid)) errors.txid = 'pixTxid';

    const message = stripAccents(v.message ?? '')
      .replace(/[^\x20-\x7e]/g, '')
      .trim();
    if (key && 4 + 14 + 4 + key.key.length + (message ? 4 + message.length : 0) > 99) errors.message = 'pixMessageLong';

    if (Object.keys(errors).length > 0 || !key) return fail(errors);
    return ok(
      pixPayload({ key: key.key, name, city, amount, txid: txid || undefined, message: message || undefined }),
      notes,
    );
  },
};
