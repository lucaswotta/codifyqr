import { ECC_LEVELS, type Ecc } from './encoder';

export type ModuleShape = 'square' | 'rounded' | 'dots' | 'classy' | 'bars';
export type EyeFrameShape = 'square' | 'rounded' | 'circle';
export type EyeBallShape = 'square' | 'rounded' | 'circle';

export const MODULE_SHAPES: readonly ModuleShape[] = ['square', 'rounded', 'dots', 'classy', 'bars'];
export const EYE_FRAME_SHAPES: readonly EyeFrameShape[] = ['square', 'rounded', 'circle'];
export const EYE_BALL_SHAPES: readonly EyeBallShape[] = ['square', 'rounded', 'circle'];

export interface LogoSpec {
  /** data: URL of the image. */
  href: string;
  /** Side of the cleared square as a fraction of the code side, before clamping to the ecc limit. */
  ratio: number;
}

export interface QrStyle {
  shape: ModuleShape;
  eyeFrame: EyeFrameShape;
  eyeBall: EyeBallShape;
  fg: string;
  /** Gradient end color; null keeps a solid fill. */
  fg2: string | null;
  gradient: 'linear' | 'radial';
  gradientAngle: number;
  /** Separate color for the three corner eyes; null reuses the module paint. */
  eyeColor: string | null;
  /** null means a transparent background. */
  bg: string | null;
  /** Quiet zone in modules. The standard asks for 4. */
  margin: number;
  ecc: 'auto' | Ecc;
  logo: LogoSpec | null;
}

export const DEFAULT_STYLE: QrStyle = {
  shape: 'square',
  eyeFrame: 'square',
  eyeBall: 'square',
  fg: '#111111',
  fg2: null,
  gradient: 'linear',
  gradientAngle: 45,
  eyeColor: null,
  bg: '#ffffff',
  margin: 4,
  ecc: 'auto',
  logo: null,
};

/** Largest cleared square, as a fraction of the side, that each level can recover with some margin. */
export const MAX_LOGO_RATIO: Record<Ecc, number> = { L: 0.16, M: 0.22, Q: 0.28, H: 0.32 };

export function minEccForLogoRatio(ratio: number): Ecc {
  return ECC_LEVELS.find((level) => MAX_LOGO_RATIO[level] >= ratio) ?? 'H';
}
