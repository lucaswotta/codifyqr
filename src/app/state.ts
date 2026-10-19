import { PAYLOADS, type PayloadKind, type Values } from '../payloads';
import { DEFAULT_STYLE, type QrStyle } from '../qr/style';
import type { FrameId, FrameText } from '../qr/templates';

export interface StudioState {
  kind: PayloadKind;
  values: Partial<Record<PayloadKind, Values>>;
  touched: Set<string>;
  style: QrStyle;
  frame: FrameId;
  frameText: Record<keyof FrameText, string | null>;
  pngSize: number;
  batch: {
    input: string;
    format: 'png' | 'svg';
    size: 512 | 1024 | 2048;
  };
  scan: {
    text: string | null;
  };
}

export const state: StudioState = {
  kind: 'text',
  values: {},
  touched: new Set(),
  style: { ...DEFAULT_STYLE },
  frame: 'none',
  frameText: { headline: null, subline: null, footnote: null },
  pngSize: 1024,
  batch: { input: '', format: 'png', size: 1024 },
  scan: { text: null },
};

export function valuesFor(kind: PayloadKind): Values {
  let values = state.values[kind];
  if (!values) {
    values = {};
    for (const field of PAYLOADS[kind].fields) if (field.value !== undefined) values[field.name] = field.value;
    state.values[kind] = values;
  }
  return values;
}
