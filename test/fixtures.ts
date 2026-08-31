import type { Sample } from '../src/types';

/** A short, sharp, straight downward flick → rock (accelerating, like a real flick). */
export function rockFlick(): Sample[] {
  const buf: Sample[] = [];
  // Quadratic downward displacement → velocity ramps then peaks (a spike profile).
  for (let i = 0; i <= 8; i++) {
    buf.push({ t: i * 6, x: 100 + i * 0.3, y: 100 + i * i * 3 });
  }
  return buf;
}

/** A sustained horizontal sweep → paper. */
export function paperSweep(): Sample[] {
  const buf: Sample[] = [];
  for (let i = 0; i <= 16; i++) {
    buf.push({ t: i * 16, x: 60 + i * 12, y: 120 + i * 0.2 });
  }
  return buf;
}

/** A zig-zag with two direction reversals → scissors. */
export function scissorsSnip(): Sample[] {
  const pts: Array<[number, number]> = [
    [100, 100],
    [130, 96],
    [100, 92], // reversal 1 (x)
    [132, 88],
    [102, 84], // reversal 2 (x)
    [134, 80],
  ];
  return pts.map(([x, y], i) => ({ t: i * 10, x, y }));
}

/** A tiny jiggle below the motion gate → low confidence. */
export function jiggle(): Sample[] {
  return [
    { t: 0, x: 100, y: 100 },
    { t: 8, x: 101, y: 100 },
    { t: 16, x: 100, y: 101 },
  ];
}
