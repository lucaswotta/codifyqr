import { svgToCanvas } from '../export/raster';
import type { QrStyle } from '../qr/style';
import { planQr, type QrPlan, renderQrSvg } from '../qr/svg';
import { applyFix, type Cause, type CauseId, FIX_ORDER, type FixId, staticCauses } from './analysis';
import { decodeCanvas } from './decode';

export type VerifyState = 'ok' | 'risk' | 'fail';

/**
 * Simulated camera quality: pixels per module and blur radius in pixels.
 * Chosen so a plain black on white code reads at every level while weak contrast does not.
 */
const LEVELS = [
  { ppm: 3, blur: 1 },
  { ppm: 5, blur: 1 },
  { ppm: 10, blur: 0 },
] as const;

export interface VerifyResult {
  state: VerifyState;
  causes: Cause[];
  /** One entry per scale: true when the decoded text matched. */
  reads: boolean[];
  plan: QrPlan;
}

async function readsAt(
  plan: QrPlan,
  text: string,
  level: (typeof LEVELS)[number],
): Promise<{ read: boolean; mismatch: boolean }> {
  const total = plan.matrix.size + Math.max(0, plan.style.margin) * 2;
  const px = Math.max(64, Math.round(total * level.ppm));
  const source = await svgToCanvas(renderQrSvg(plan, { px }), px);
  // Read on white, like paper, with the blur of a mediocre camera.
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { read: false, mismatch: false };
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  if (level.blur > 0 && 'filter' in ctx) ctx.filter = `blur(${level.blur}px)`;
  ctx.drawImage(source, 0, 0);
  const decoded = await decodeCanvas(canvas);
  return { read: decoded === text, mismatch: decoded !== null && decoded !== text };
}

export async function verifyQr(text: string, style: QrStyle): Promise<VerifyResult> {
  const plan = planQr(text, style);
  const causes = staticCauses(style, plan);
  const reads: boolean[] = [];
  let mismatch = false;
  for (const level of LEVELS) {
    const r = await readsAt(plan, text, level);
    reads.push(r.read);
    mismatch ||= r.mismatch;
  }
  if (mismatch) causes.push({ id: 'mismatch', level: 'fail' });

  const [small, medium, large] = reads as [boolean, boolean, boolean];
  const hasFailCause = causes.some((c) => c.level === 'fail');
  let state: VerifyState;
  if (!medium && !large) state = 'fail';
  else if (small && medium && large && causes.length === 0) state = 'ok';
  else if (hasFailCause && !(small && medium && large)) state = 'fail';
  else state = 'risk';
  return { state, causes, reads, plan };
}

export interface FixSuggestion {
  fixes: FixId[];
  style: QrStyle;
  state: VerifyState;
}

/** Applies fixes one after the other until the code verifies, and reports what it took. */
export async function suggestFix(text: string, style: QrStyle, current: VerifyResult): Promise<FixSuggestion | null> {
  const order = FIX_ORDER;
  const applied: FixId[] = [];
  let working = style;
  let plan = current.plan;
  let best: FixSuggestion | null = null;
  const rank = { fail: 0, risk: 1, ok: 2 } as const;
  for (const id of order) {
    const next = applyFix(id, working, plan);
    if (!next) continue;
    working = next;
    applied.push(id);
    const result = await verifyQr(text, working);
    plan = result.plan;
    if (!best || rank[result.state] >= rank[best.state])
      best = { fixes: [...applied], style: working, state: result.state };
    if (result.state === 'ok') break;
  }
  return best && rank[best.state] > rank[current.state] ? best : null;
}

export type { CauseId, FixId };
