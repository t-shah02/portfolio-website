export const TAU = Math.PI * 2;

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const lerp = (from, to, t) => from + (to - from) * t;

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Deterministic PRNG so stars and clouds keep their places between reloads. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (random, min, max) => min + (max - min) * random();
