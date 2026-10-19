import { app, email, event, geo, sms, text, vcard, whatsapp, wifi } from './formats';
import { pix } from './pix';
import type { PayloadKind, PayloadSpec } from './types';

export const PAYLOADS: Record<PayloadKind, PayloadSpec> = {
  text,
  pix,
  wifi,
  vcard,
  email,
  sms,
  whatsapp,
  geo,
  event,
  app,
};

export {
  type BuildResult,
  type FieldSpec,
  PAYLOAD_KINDS,
  type PayloadKind,
  type PayloadSpec,
  type Values,
} from './types';
