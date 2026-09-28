import { clamp, lerp, smoothstep } from "./math.js";

export const THEME_KEYS = ["paper", "paper-deep", "foam", "ink", "ink-soft", "coffee", "terracotta", "line"];
const SURFACES = ["paper", "paper-deep", "foam", "line"];

/** Below this altitude the page switches to its evening (dark) roast. */
export const NIGHT_BELOW = -0.04;

// The site's original palette is the midday look.
export const DAY = {
  paper: "#f4ecdf",
  "paper-deep": "#e7d8c4",
  foam: "#fbf7f1",
  ink: "#2a2118",
  "ink-soft": "#5e5146",
  coffee: "#6a4128",
  terracotta: "#8d4330",
  line: "#d9c7b0",
};
const GOLDEN_HOUR = {
  paper: "#f5e3cd",
  "paper-deep": "#eacfb0",
  foam: "#fcf3e7",
  ink: "#2c1e14",
  "ink-soft": "#5f4636",
  coffee: "#743f20",
  terracotta: "#924022",
  line: "#dfc3a2",
};
const DAWN = {
  paper: "#f2e8e1",
  "paper-deep": "#e3d3c9",
  foam: "#fbf6f3",
  ink: "#2a2220",
  "ink-soft": "#5b4f4c",
  coffee: "#6b4434",
  terracotta: "#8c463b",
  line: "#d9c6bb",
};
const BLUE_HOUR = {
  paper: "#2a2322",
  "paper-deep": "#382d2b",
  foam: "#322927",
  ink: "#f3e9de",
  "ink-soft": "#cfbfb1",
  coffee: "#e9bb93",
  terracotta: "#f0a487",
  line: "#4b3d38",
};
const MIDNIGHT = {
  paper: "#1a1512",
  "paper-deep": "#261f1a",
  foam: "#221b17",
  ink: "#efe4d6",
  "ink-soft": "#c2b19f",
  coffee: "#deb088",
  terracotta: "#eb9878",
  line: "#3a2f28",
};

const LIGHT_SKY = [
  [NIGHT_BELOW, { zenith: "#a9a2c4", horizon: "#f3a877" }],
  [0.1, { zenith: "#b6c4d8", horizon: "#f5c998" }],
  [0.4, { zenith: "#cde0ea", horizon: "#f3e6d5" }],
];
const DARK_SKY = [
  [-0.6, { zenith: "#0a0e1b", horizon: "#1b1824" }],
  [-0.25, { zenith: "#141932", horizon: "#2c2238" }],
  [NIGHT_BELOW, { zenith: "#2a2e4f", horizon: "#58394a" }],
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const channel = (value) => clamp(Math.round(value), 0, 255);
  return `#${((1 << 24) | (channel(r) << 16) | (channel(g) << 8) | channel(b)).toString(16).slice(1)}`;
}

export function mix(from, to, t) {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(clamp(alpha) * 1000) / 1000})`;
}

export function mixAll(from, to, t) {
  const out = {};
  for (const key of Object.keys(from)) {
    out[key] = typeof from[key] === "number" ? lerp(from[key], to[key], clamp(t)) : mix(from[key], to[key], t);
  }
  return out;
}

export function sampleStops(stops, x) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [at, value] = stops[i];
    if (x <= at) {
      const [prevAt, prev] = stops[i - 1];
      return mixAll(prev, value, smoothstep(prevAt, at, x));
    }
  }
  return stops[stops.length - 1][1];
}

export function desaturate(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  return mix(hex, rgbToHex([grey, grey, grey]), amount);
}

/** Largest single-channel difference across two palettes (0–255). */
export function paletteDistance(a, b) {
  let max = 0;
  for (const key of THEME_KEYS) {
    const x = hexToRgb(a[key]);
    const y = hexToRgb(b[key]);
    for (let i = 0; i < 3; i += 1) max = Math.max(max, Math.abs(x[i] - y[i]));
  }
  return max;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** CSS custom properties for the page at this point in the day. */
export function themeAt(clock, weather) {
  const { altitude, morning } = clock;
  const night = altitude < NIGHT_BELOW;
  const vars = night
    ? mixAll(BLUE_HOUR, MIDNIGHT, smoothstep(NIGHT_BELOW, -0.4, altitude))
    : mixAll(morning ? DAWN : GOLDEN_HOUR, DAY, smoothstep(NIGHT_BELOW, 0.35, altitude));
  const grey = clamp(weather.cloud) * 0.3;
  for (const key of SURFACES) vars[key] = desaturate(vars[key], grey);
  return { vars, scheme: night ? "dark" : "light" };
}

/**
 * Canvas colours. `darkness` (0–1) follows the page theme's transition so the
 * sky behind the text always flips together with the text colour.
 */
export function skyAt(clock, weather, darkness) {
  const { altitude: a, morning } = clock;
  const cloud = clamp(weather.cloud);
  const storm = cloud * Math.max(weather.rain, weather.snow * 0.6, weather.thunder);
  const sunset = 1 - smoothstep(0, 0.25, a);

  const light = sampleStops(LIGHT_SKY, a);
  if (morning) light.horizon = mix(light.horizon, "#f2bcae", sunset * 0.6);
  const dark = sampleStops(DARK_SKY, a);
  const veil = mix("#d2cdc7", "#1e1e25", darkness);

  const cloudLight = mix(mix("#fffaf3", "#ffd6b8", sunset), "#4b4760", darkness);
  const cloudShade = mix(mix("#dcd3ca", "#c5979a", sunset), "#26242f", darkness);
  const stormTone = mix("#a8a3a6", "#2a2930", darkness);

  return {
    zenith: mix(mix(light.zenith, dark.zenith, darkness), veil, cloud * 0.55),
    horizon: mix(mix(light.horizon, dark.horizon, darkness), veil, cloud * 0.35),
    veil,
    veilAlpha: smoothstep(0.4, 1, cloud) * 0.5,
    glow: mix("#ffcf96", "#ff8f5a", 1 - smoothstep(-0.1, 0.25, a)),
    glowAlpha: (1 - smoothstep(0, 0.3, Math.abs(a))) * 0.6 * (1 - cloud * 0.7),
    stars: darkness * smoothstep(NIGHT_BELOW, -0.25, a) * (1 - cloud * 0.9),
    sunWarmth: 1 - smoothstep(0.02, 0.4, a),
    cloudLight: mix(cloudLight, stormTone, storm * 0.5),
    cloudShade: mix(cloudShade, stormTone, storm * 0.6),
    rain: mix("#6b7a90", "#a9b5c9", darkness),
    snow: mix("#ffffff", "#e8ecf4", darkness),
    snowEdge: "#7d889c",
    fog: mix("#eee8e0", "#2c2a31", darkness),
  };
}
