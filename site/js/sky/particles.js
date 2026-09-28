import { TAU, between } from "./math.js";
import { rgba } from "./palette.js";

// Three depth layers: far drops are thin, faint and slow.
const LAYERS = [
  { width: 0.8, alpha: 0.28, speed: 0.65, size: 0.6 },
  { width: 1.1, alpha: 0.42, speed: 0.85, size: 0.85 },
  { width: 1.5, alpha: 0.58, speed: 1, size: 1.15 },
];
const RAIN_SPEED = 950;
const WIND_PUSH = 0.45;

function split(count, make) {
  const layers = LAYERS.map(() => []);
  for (let i = 0; i < count; i += 1) layers[i % LAYERS.length].push(make(i % LAYERS.length));
  return layers;
}

export function createRain(count, width, height, random) {
  return split(count, (layer) => ({
    x: between(random, -0.3, 1.3) * width,
    y: random() * height,
    length: between(random, 12, 22) * LAYERS[layer].size,
    speed: RAIN_SPEED * LAYERS[layer].speed * between(random, 0.85, 1.15),
  }));
}

export function stepRain(layers, dt, width, height, wind, random) {
  for (const drops of layers) {
    for (const drop of drops) {
      drop.y += drop.speed * dt;
      drop.x += drop.speed * wind * WIND_PUSH * dt;
      if (drop.y - drop.length > height) {
        drop.y = -drop.length - random() * height * 0.1;
        drop.x = between(random, -0.3, 1.3) * width;
      }
    }
  }
}

export function drawRain(ctx, layers, color, wind) {
  ctx.save();
  ctx.lineCap = "round";
  layers.forEach((drops, i) => {
    if (drops.length === 0) return;
    const layer = LAYERS[i];
    ctx.strokeStyle = rgba(color, layer.alpha);
    ctx.lineWidth = layer.width;
    ctx.beginPath();
    for (const drop of drops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - wind * WIND_PUSH * drop.length, drop.y - drop.length);
    }
    ctx.stroke();
  });
  ctx.restore();
}

export function createSnow(count, width, height, random) {
  return split(count, (layer) => ({
    x: random() * width,
    y: random() * height,
    r: between(random, 1.2, 2.6) * LAYERS[layer].size,
    speed: between(random, 28, 60) * LAYERS[layer].speed,
    sway: between(random, 10, 28),
    phase: random() * TAU,
  }));
}

export function stepSnow(layers, dt, t, width, height, wind, random) {
  for (const flakes of layers) {
    for (const flake of flakes) {
      flake.y += flake.speed * dt;
      flake.x += (Math.sin(t * 0.8 + flake.phase) * flake.sway + wind * 90) * dt;
      if (flake.y - flake.r > height) {
        flake.y = -flake.r - random() * 20;
        flake.x = random() * width;
      }
      if (flake.x > width + 10) flake.x = -10;
      else if (flake.x < -10) flake.x = width + 10;
    }
  }
}

/** White flakes vanish against a pale daytime sky, so they get a faint cool rim (`edgeAlpha` 0 at night). */
export function drawSnow(ctx, layers, color, edge = color, edgeAlpha = 0) {
  ctx.save();
  ctx.lineWidth = 0.8;
  layers.forEach((flakes, i) => {
    if (flakes.length === 0) return;
    ctx.fillStyle = rgba(color, LAYERS[i].alpha + 0.3);
    ctx.beginPath();
    for (const flake of flakes) {
      ctx.moveTo(flake.x + flake.r, flake.y);
      ctx.arc(flake.x, flake.y, flake.r, 0, TAU);
    }
    ctx.fill();
    if (edgeAlpha > 0.01) {
      ctx.strokeStyle = rgba(edge, edgeAlpha * LAYERS[i].alpha);
      ctx.stroke();
    }
  });
  ctx.restore();
}

/**
 * Thunderstorm flashes. Kept soft (peak ~20% white) and never faster than one
 * strike every few seconds, out of respect for photosensitive visitors.
 */
export function createLightning(random) {
  return { random, wait: between(random, 3, 8), flash: 0, age: Infinity, bolt: null };
}

export function stepLightning(state, dt, thunder, width, height) {
  state.age += dt;
  state.flash = flashCurve(state.age);
  if (thunder <= 0) return;
  state.wait -= dt;
  if (state.wait > 0) return;
  const { random } = state;
  state.age = 0;
  state.wait = between(random, 6, 16) / thunder;
  state.bolt = random() < 0.6 ? boltPath(random, width, height) : null;
}

export function flashCurve(age) {
  if (age < 0.08) return 0.2 * (age / 0.08);
  if (age < 0.16) return 0.2 - 0.12 * ((age - 0.08) / 0.08);
  if (age < 0.24) return 0.08 + 0.1 * ((age - 0.16) / 0.08);
  if (age < 0.9) return 0.18 * (1 - (age - 0.24) / 0.66);
  return 0;
}

function boltPath(random, width, height) {
  const points = [];
  let x = between(random, 0.15, 0.85) * width;
  let y = 0;
  const bottom = between(random, 0.35, 0.6) * height;
  while (y < bottom) {
    points.push([x, y]);
    y += between(random, 18, 42);
    x += between(random, -26, 26);
  }
  points.push([x, bottom]);
  return points;
}

export function drawLightning(ctx, state, width, height) {
  if (state.flash <= 0.001) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,250,240,${state.flash})`;
  ctx.fillRect(0, 0, width, height);
  if (state.bolt) {
    ctx.strokeStyle = `rgba(255,248,230,${Math.min(1, state.flash * 5)})`;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    state.bolt.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }
  ctx.restore();
}

/** Low mist banks that roll slowly along the bottom of the viewport. */
export function drawFog(ctx, { width, height, t, fog, color }) {
  if (fog <= 0.01) return;
  ctx.save();
  for (let i = 0; i < 3; i += 1) {
    const top = height * (0.45 + i * 0.12);
    const drift = Math.sin(t * 0.05 + i * 2.1) * width * 0.04;
    const band = ctx.createLinearGradient(0, top, 0, height);
    band.addColorStop(0, rgba(color, 0));
    band.addColorStop(0.6, rgba(color, fog * 0.28));
    band.addColorStop(1, rgba(color, fog * 0.4));
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-width * 0.1, height);
    for (let x = -0.1; x <= 1.1; x += 0.1) {
      ctx.lineTo(x * width + drift, top + Math.sin(x * 7 + i + t * 0.07) * height * 0.03);
    }
    ctx.lineTo(width * 1.1, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
