import { type QrPlan, qrPaths, safeColor } from './svg';

export function renderQrCanvas(plan: QrPlan, canvas: OffscreenCanvas, logo?: ImageBitmap): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const { style } = plan;
  const { modules, eyes, box, total, margin } = qrPaths(plan);
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(canvas.width / total, canvas.height / total);
  if (style.bg) {
    ctx.fillStyle = safeColor(style.bg, '#ffffff');
    ctx.fillRect(0, 0, total, total);
  }
  const fg = safeColor(style.fg, '#000000');
  let paint: string | CanvasGradient = fg;
  if (style.fg2) {
    const c = total / 2;
    const angle = (style.gradientAngle * Math.PI) / 180;
    const dx = Math.cos(angle) * c;
    const dy = Math.sin(angle) * c;
    paint =
      style.gradient === 'radial'
        ? ctx.createRadialGradient(c, c, 0, c, c, c * 1.2)
        : ctx.createLinearGradient(c - dx, c - dy, c + dx, c + dy);
    paint.addColorStop(0, fg);
    paint.addColorStop(1, safeColor(style.fg2, fg));
  }
  ctx.fillStyle = paint;
  ctx.fill(new Path2D(modules));
  ctx.fillStyle = style.eyeColor ? safeColor(style.eyeColor, fg) : paint;
  ctx.fill(new Path2D(eyes), 'evenodd');
  if (box && logo) {
    const pad = Math.max(0.5, box.len * 0.06);
    const edge = box.len - pad * 2;
    const scale = edge / Math.max(logo.width, logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      logo,
      margin + box.x + pad + (edge - width) / 2,
      margin + box.y + pad + (edge - height) / 2,
      width,
      height,
    );
  }
}
