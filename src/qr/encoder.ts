// QR Code Model 2 encoder (versions 1-40, byte/alphanumeric/numeric modes).
// The algorithm follows Project Nayuki's QR Code generator (MIT License,
// https://www.nayuki.io/page/qr-code-generator-library). See NOTICE.

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  readonly version: number;
  readonly size: number;
  readonly ecc: Ecc;
  readonly mask: number;
  /** Row-major, 1 = dark. */
  readonly modules: Uint8Array;
  get(x: number, y: number): boolean;
}

const ECC_ORDINAL: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };
export const ECC_LEVELS: readonly Ecc[] = ['L', 'M', 'Q', 'H'];

const MIN_VERSION = 1;
const MAX_VERSION = 40;

// Index 0 is padding. Rows: L, M, Q, H.
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
];

const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
    33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
    45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48,
    51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

type Mode = 'numeric' | 'alphanumeric' | 'byte';
const MODE_BITS: Record<Mode, number> = { numeric: 0x1, alphanumeric: 0x2, byte: 0x4 };
const CHAR_COUNT_BITS: Record<Mode, readonly [number, number, number]> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

interface Segment {
  mode: Mode;
  charCount: number;
  bits: number[];
}

function appendBits(buffer: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) buffer.push((value >>> i) & 1);
}

function bitAt(value: number, i: number): boolean {
  return ((value >>> i) & 1) !== 0;
}

function numericSegment(digits: string): Segment {
  const bits: number[] = [];
  for (let i = 0; i < digits.length; ) {
    const n = Math.min(digits.length - i, 3);
    appendBits(bits, Number.parseInt(digits.substring(i, i + n), 10), n * 3 + 1);
    i += n;
  }
  return { mode: 'numeric', charCount: digits.length, bits };
}

function alphanumericSegment(text: string): Segment {
  const bits: number[] = [];
  let i = 0;
  for (; i + 2 <= text.length; i += 2) {
    const a = ALPHANUMERIC.indexOf(text.charAt(i));
    const b = ALPHANUMERIC.indexOf(text.charAt(i + 1));
    appendBits(bits, a * 45 + b, 11);
  }
  if (i < text.length) appendBits(bits, ALPHANUMERIC.indexOf(text.charAt(i)), 6);
  return { mode: 'alphanumeric', charCount: text.length, bits };
}

function byteSegment(data: Uint8Array): Segment {
  const bits: number[] = [];
  for (const b of data) appendBits(bits, b, 8);
  return { mode: 'byte', charCount: data.length, bits };
}

function makeSegments(text: string): Segment[] {
  if (text === '') return [];
  if (/^[0-9]*$/.test(text)) return [numericSegment(text)];
  if (/^[A-Z0-9 $%*+\-./:]*$/.test(text)) return [alphanumericSegment(text)];
  return [byteSegment(new TextEncoder().encode(text))];
}

function charCountBits(mode: Mode, version: number): number {
  const table = CHAR_COUNT_BITS[mode];
  return table[version < 10 ? 0 : version < 27 ? 1 : 2];
}

function segmentsBitLength(segments: Segment[], version: number): number {
  let total = 0;
  for (const seg of segments) {
    const ccBits = charCountBits(seg.mode, version);
    if (seg.charCount >= 1 << ccBits) return Number.POSITIVE_INFINITY;
    total += 4 + ccBits + seg.bits.length;
  }
  return total;
}

function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(version: number, ecc: Ecc): number {
  const o = ECC_ORDINAL[ecc];
  return (
    Math.floor(numRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[o]![version]! * NUM_ERROR_CORRECTION_BLOCKS[o]![version]!
  );
}

/** Capacity in bytes (byte mode) of a version/ecc pair, for UI hints and tests. */
export function byteCapacity(version: number, ecc: Ecc): number {
  const dataBits = numDataCodewords(version, ecc) * 8;
  const ccBits = charCountBits('byte', version);
  return Math.max(0, Math.floor((dataBits - 4 - ccBits) / 8));
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree - 1).fill(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = result[i]! ^ gfMultiply(coef, factor);
    });
  }
  return result;
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Builder {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(
    readonly version: number,
    readonly ecc: Ecc,
    dataCodewords: number[],
    mask: number,
  ) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));

    this.drawFunctionPatterns();
    this.drawCodewords(this.addEccAndInterleave(dataCodewords));

    if (mask === -1) {
      let minPenalty = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.penaltyScore();
        if (penalty < minPenalty) {
          mask = i;
          minPenalty = penalty;
        }
        this.applyMask(i); // XOR undoes the mask
      }
    }
    this.mask = mask;
    this.applyMask(mask);
    this.drawFormatBits(mask);
  }

  readonly mask: number;

  private setFunction(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }

  private drawFunctionPatterns(): void {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    const positions = alignmentPositions(this.version, size);
    const last = positions.length - 1;
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.drawAlignment(positions[i]!, positions[j]!);
      }
    }
    this.drawFormatBits(0);
    this.drawVersion();
  }

  private drawFormatBits(mask: number): void {
    const { size } = this;
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bitAt(bits, i));
    this.setFunction(8, 7, bitAt(bits, 6));
    this.setFunction(8, 8, bitAt(bits, 7));
    this.setFunction(7, 8, bitAt(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bitAt(bits, i));

    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, bitAt(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, bitAt(bits, i));
    this.setFunction(8, size - 8, true);
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = bitAt(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  private addEccAndInterleave(data: number[]): number[] {
    const o = ECC_ORDINAL[this.ecc];
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[o]![this.version]!;
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[o]![this.version]!;
    const rawCodewords = Math.floor(numRawDataModules(this.version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: number[][] = [];
    const divisor = rsDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const result: number[] = [];
    for (let i = 0; i < blocks[0]!.length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]!);
      });
    }
    return result;
  }

  private drawCodewords(data: number[]): void {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y]![x]! && i < data.length * 8) {
            this.modules[y]![x] = bitAt(data[i >>> 3]!, 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            throw new RangeError('Invalid mask');
        }
        if (!this.isFunction[y]![x]! && invert) this.modules[y]![x] = !this.modules[y]![x]!;
      }
    }
  }

  private penaltyScore(): number {
    const { size, modules } = this;
    let result = 0;

    for (let y = 0; y < size; y++) {
      let runColor = false;
      let runX = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y]![x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          this.finderAddHistory(runX, history);
          if (!runColor) result += this.finderCountPatterns(history) * PENALTY_N3;
          runColor = modules[y]![x]!;
          runX = 1;
        }
      }
      result += this.finderTerminateAndCount(runColor, runX, history) * PENALTY_N3;
    }

    for (let x = 0; x < size; x++) {
      let runColor = false;
      let runY = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y]![x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          this.finderAddHistory(runY, history);
          if (!runColor) result += this.finderCountPatterns(history) * PENALTY_N3;
          runColor = modules[y]![x]!;
          runY = 1;
        }
      }
      result += this.finderTerminateAndCount(runColor, runY, history) * PENALTY_N3;
    }

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const color = modules[y]![x]!;
        if (color === modules[y]![x + 1] && color === modules[y + 1]![x] && color === modules[y + 1]![x + 1]) {
          result += PENALTY_N2;
        }
      }
    }

    let dark = 0;
    for (const row of modules) for (const m of row) if (m) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    return result + k * PENALTY_N4;
  }

  private finderCountPatterns(history: readonly number[]): number {
    const n = history[1]!;
    const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
    return (
      (core && history[0]! >= n * 4 && history[6]! >= n ? 1 : 0) +
      (core && history[6]! >= n * 4 && history[0]! >= n ? 1 : 0)
    );
  }

  private finderTerminateAndCount(runColor: boolean, runLength: number, history: number[]): number {
    if (runColor) {
      this.finderAddHistory(runLength, history);
      runLength = 0;
    }
    runLength += this.size;
    this.finderAddHistory(runLength, history);
    return this.finderCountPatterns(history);
  }

  private finderAddHistory(runLength: number, history: number[]): void {
    if (history[0] === 0) runLength += this.size;
    history.pop();
    history.unshift(runLength);
  }
}

export interface EncodeOptions {
  /** Minimum error correction level. Raised automatically when it costs no version. */
  ecc?: Ecc;
  boostEcc?: boolean;
  minVersion?: number;
  maxVersion?: number;
  /** Force a mask pattern 0-7; -1 picks the best one. */
  mask?: number;
}

export class DataTooLongError extends RangeError {
  constructor() {
    super('Data too long for a QR code');
    this.name = 'DataTooLongError';
  }
}

export function encodeText(text: string, options: EncodeOptions = {}): QrMatrix {
  const { boostEcc = true, minVersion = MIN_VERSION, maxVersion = MAX_VERSION, mask = -1 } = options;
  let ecc: Ecc = options.ecc ?? 'M';
  const segments = makeSegments(text);

  let version = minVersion;
  let usedBits = 0;
  for (; ; version++) {
    const capacityBits = numDataCodewords(version, ecc) * 8;
    usedBits = segmentsBitLength(segments, version);
    if (usedBits <= capacityBits) break;
    if (version >= maxVersion) throw new DataTooLongError();
  }

  if (boostEcc) {
    for (const candidate of ECC_LEVELS) {
      if (ECC_ORDINAL[candidate] > ECC_ORDINAL[ecc] && usedBits <= numDataCodewords(version, candidate) * 8)
        ecc = candidate;
    }
  }

  const bits: number[] = [];
  for (const seg of segments) {
    appendBits(bits, MODE_BITS[seg.mode], 4);
    appendBits(bits, seg.charCount, charCountBits(seg.mode, version));
    for (const b of seg.bits) bits.push(b);
  }

  const capacityBits = numDataCodewords(version, ecc) * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

  const codewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => {
    codewords[i >>> 3] = codewords[i >>> 3]! | (b << (7 - (i & 7)));
  });

  const built = new Builder(version, ecc, codewords, mask);
  const modules = new Uint8Array(built.size * built.size);
  for (let y = 0; y < built.size; y++)
    for (let x = 0; x < built.size; x++) modules[y * built.size + x] = built.modules[y]![x]! ? 1 : 0;

  return {
    version,
    size: built.size,
    ecc,
    mask: built.mask,
    modules,
    get: (x, y) => x >= 0 && y >= 0 && x < built.size && y < built.size && modules[y * built.size + x] === 1,
  };
}
