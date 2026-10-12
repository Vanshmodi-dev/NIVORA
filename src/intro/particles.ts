/**
 * Pure maths for the brand-intro particle choreography. Kept free of DOM and canvas so it can be
 * unit-tested; the canvas code only calls these functions.
 */

export const TIMELINE = {
  /** Particles travel from darkness to their place in the logo. */
  assembleEnd: 2000,
  /** Crisp logo cross-fades over the particles. */
  crispStart: 1750,
  crispEnd: 2500,
  /** Wordmark descriptor and tagline reveal (DOM). */
  descriptorAt: 2100,
  taglineAt: 2500,
  /** Golden light sweep across the logo. */
  sweepStart: 2650,
  sweepEnd: 3250,
  /** Whole sequence, then a short fade into the app. */
  total: 3500,
  fadeOut: 350,
} as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;

export interface Particle {
  /** Target (final) position. */
  tx: number;
  ty: number;
  /** Start position, scattered in the dark. */
  sx: number;
  sy: number;
  /** Delay (0..1 of the staggered window) and curl direction for the flowing arc. */
  delay: number;
  curl: number;
  size: number;
  hue: number;
}

/** Deterministic pseudo-random so the choreography is repeatable and testable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds particles for the given target points, scattered on a wide ring around the centre. */
export function buildParticles(targets: ReadonlyArray<readonly [number, number]>, width: number, height: number, seed = 7): Particle[] {
  const rand = mulberry32(seed);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(width, height) * 0.6;
  return targets.map(([tx, ty]) => {
    const angle = rand() * Math.PI * 2;
    const r = radius * (0.55 + rand() * 0.45);
    return {
      tx,
      ty,
      sx: cx + Math.cos(angle) * r,
      sy: cy + Math.sin(angle) * r,
      delay: rand() * 0.35,
      curl: (rand() < 0.5 ? -1 : 1) * (0.15 + rand() * 0.25),
      size: 0.9 + rand() * 1.0,
      hue: rand(),
    };
  });
}

/**
 * Position of a particle at time `t` (ms). It follows a gently curved path (a quadratic Bézier
 * bent perpendicular to the straight line) so the flow reads as engineered, not random.
 */
export function particlePosition(p: Particle, t: number): { x: number; y: number; progress: number } {
  const window = TIMELINE.assembleEnd * (1 - 0.35);
  const local = clamp01((t - p.delay * TIMELINE.assembleEnd) / window);
  const k = easeOutCubic(local);
  const dx = p.tx - p.sx;
  const dy = p.ty - p.sy;
  // Control point: midpoint pushed perpendicular to the path.
  const mx = p.sx + dx * 0.5 - dy * p.curl;
  const my = p.sy + dy * 0.5 + dx * p.curl;
  const a = (1 - k) * (1 - k);
  const b = 2 * (1 - k) * k;
  const c = k * k;
  return { x: a * p.sx + b * mx + c * p.tx, y: a * p.sy + b * my + c * p.ty, progress: local };
}

/** 0 → 1 opacity of the crisp logo layer. */
export const crispAlpha = (t: number) => easeInOutSine((t - TIMELINE.crispStart) / (TIMELINE.crispEnd - TIMELINE.crispStart));

/** 0 → 1 position of the light sweep across the logo (−0.2…1.2 so it enters and leaves cleanly). */
export const sweepPosition = (t: number) => -0.2 + 1.4 * clamp01((t - TIMELINE.sweepStart) / (TIMELINE.sweepEnd - TIMELINE.sweepStart));
