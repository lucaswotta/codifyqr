export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'password'
  | 'select'
  | 'textarea'
  | 'datetime-local'
  | 'checkbox';

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  options?: readonly string[];
  /** Initial value. */
  value?: string;
  autocomplete?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url';
}

export type Values = Record<string, string>;

export type BuildResult = { ok: true; text: string; notes: string[] } | { ok: false; errors: Record<string, string> };

export interface PayloadSpec {
  kind: PayloadKind;
  /** Content that must never be persisted (saved styles, URL hash, history). */
  sensitive: boolean;
  fields: readonly FieldSpec[];
  build(values: Values): BuildResult;
}

export const PAYLOAD_KINDS = [
  'text',
  'pix',
  'wifi',
  'vcard',
  'email',
  'sms',
  'whatsapp',
  'geo',
  'event',
  'app',
] as const;
export type PayloadKind = (typeof PAYLOAD_KINDS)[number];

export const ok = (text: string, notes: string[] = []): BuildResult => ({ ok: true, text, notes });
export const fail = (errors: Record<string, string>): BuildResult => ({ ok: false, errors });
