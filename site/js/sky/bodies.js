import { TAU, clamp } from "./math.js";
import { mix, rgba } from "./palette.js";

const CUP = "#fbf4ea";
const SAUCER_LIGHT = "#fffaf2";
const SAUCER_SHADE = "#e8d8c3";
const RIM_LINE = "#8a5a3a";
const FOAM = "#fbf0e0";

function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function halo(ctx, inner, outer, color, strength) {
  const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  g.addColorStop(0, rgba(color, 0.55 * strength));
  g.addColorStop(0.35, rgba(color, 0.2 * strength));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  disc(ctx, 0, 0, outer);
  ctx.fill();
}

/** Heart pointing down, centred on the origin, `s` ≈ its height. */
function heart(ctx, s, dy = 0) {
  ctx.beginPath();
  ctx.moveTo(0, dy + s * 0.55);
  ctx.bezierCurveTo(-s * 0.95, dy + s * 0.02, -s * 0.5, dy - s * 0.62, 0, dy - s * 0.24);
  ctx.bezierCurveTo(s * 0.5, dy - s * 0.62, s * 0.95, dy + s * 0.02, 0, dy + s * 0.55);
  ctx.closePath();
}

/** Rosetta heart: nested foam and espresso hearts with a pull-through line. */
function latteArt(ctx, r, coffee) {
  const rings = [1, 0.74, 0.5, 0.28];
  rings.forEach((scale, i) => {
    ctx.fillStyle = i % 2 === 0 ? FOAM : coffee;
    heart(ctx, r * 1.25 * scale, r * 0.12 * (1 - scale));
    ctx.fill();
  });
  ctx.strokeStyle = rgba(coffee, 0.9);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.62);
  ctx.lineTo(0, r * 0.66);
  ctx.stroke();
}

function rays(ctx, r, t, color, strength) {
  ctx.save();
  ctx.rotate(t * 0.025);
  ctx.fillStyle = rgba(color, 0.42 * strength);
  for (let i = 0; i < 16; i += 1) {
    const long = i % 2 === 0;
    const inner = r * 1.5;
    const outer = r * (long ? 2.25 : 1.9) + Math.sin(t * 0.8 + i) * r * 0.06;
    const half = r * (long ? 0.09 : 0.065);
    ctx.beginPath();
    ctx.moveTo(inner, -half);
    ctx.quadraticCurveTo(outer, 0, inner, half);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(TAU / 16);
  }
  ctx.restore();
}

/**
 * The sun is a latte seen from above: saucer, cup, crema and a rosetta heart,
 * glowing through a warm halo. `warmth` (0–1) pushes it toward sunrise orange.
 */
export function drawSun(ctx, { x, y, r, t, warmth = 0, alpha = 1 }) {
  if (alpha <= 0.001) return;
  const glow = mix("#ffd9a0", "#ff9a5c", warmth);
  const crema = mix("#c98d52", "#b8662f", warmth);
  const espresso = mix("#6f3d20", "#5a2a14", warmth);

  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.translate(x, y);

  halo(ctx, r * 0.8, r * 5.2, glow, 1);
  rays(ctx, r, t, glow, 1);

  const saucer = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r * 1.35);
  saucer.addColorStop(0, SAUCER_LIGHT);
  saucer.addColorStop(1, mix(SAUCER_SHADE, glow, 0.25));
  ctx.fillStyle = saucer;
  disc(ctx, 0, 0, r * 1.32);
  ctx.fill();
  ctx.strokeStyle = rgba(RIM_LINE, 0.14);
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  disc(ctx, 0, 0, r * 1.12);
  ctx.strokeStyle = rgba(RIM_LINE, 0.08);
  ctx.stroke();

  ctx.save();
  ctx.rotate(0.65);
  ctx.fillStyle = CUP;
  ctx.strokeStyle = rgba(RIM_LINE, 0.18);
  ctx.beginPath();
  ctx.roundRect(r * 0.88, -r * 0.17, r * 0.52, r * 0.34, r * 0.17);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const cup = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  cup.addColorStop(0, "#ffffff");
  cup.addColorStop(1, CUP);
  ctx.fillStyle = cup;
  disc(ctx, 0, 0, r);
  ctx.fill();
  ctx.strokeStyle = rgba(RIM_LINE, 0.16);
  ctx.stroke();

  const coffee = r * 0.84;
  const pour = ctx.createRadialGradient(-coffee * 0.2, -coffee * 0.25, coffee * 0.1, 0, 0, coffee);
  pour.addColorStop(0, crema);
  pour.addColorStop(0.75, mix(crema, espresso, 0.45));
  pour.addColorStop(1, espresso);
  ctx.fillStyle = pour;
  disc(ctx, 0, 0, coffee);
  ctx.fill();

  ctx.save();
  disc(ctx, 0, 0, coffee);
  ctx.clip();
  ctx.rotate(Math.sin(t * 0.12) * 0.1);
  latteArt(ctx, coffee * 0.72, mix(crema, espresso, 0.25));
  ctx.restore();

  ctx.restore();
}

// Croissant geometry, in units of the body radius.
const BEND = 0.78;
const SPREAD = 1.2;
const THICKNESS = 0.9;
const LAYERS = 5;
const SAMPLES = 48;

/** Half-thickness along the crescent: fat in the middle, pointed tips, a bulge per rolled layer. */
function croissantHalfWidth(u) {
  const body = Math.cos((u - 0.5) * Math.PI) ** 0.9;
  const rolls = 1 + 0.12 * Math.sin(u * LAYERS * Math.PI) ** 2;
  return 0.5 * THICKNESS * (0.1 + 0.9 * body) * rolls;
}

function croissantEdge(u, side, cx) {
  const angle = -SPREAD + 2 * SPREAD * u;
  const radius = BEND + side * croissantHalfWidth(u);
  return [cx + Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/**
 * The moon is a croissant: a tapered crescent with rolled layers. It faces the
 * lit side of the real moon (bulging right while waxing, left while waning).
 */
export function drawMoon(ctx, { x, y, r, t, alpha = 1, waxing = true }) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.translate(x, y);

  halo(ctx, r * 0.5, r * 4.4, "#f6e2b8", 0.8);

  ctx.scale(waxing ? r : -r, r);
  ctx.rotate(-0.45 + Math.sin(t * 0.25) * 0.03);
  const cx = -(BEND + THICKNESS / 2 + BEND * Math.cos(SPREAD)) / 2;

  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i += 1) {
    const [px, py] = croissantEdge(i / SAMPLES, 1, cx);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = SAMPLES; i >= 0; i -= 1) ctx.lineTo(...croissantEdge(i / SAMPLES, -1, cx));
  ctx.closePath();

  const bake = ctx.createLinearGradient(cx, -BEND, cx + BEND + THICKNESS, BEND);
  bake.addColorStop(0, "#f9dc9e");
  bake.addColorStop(0.5, "#e2a458");
  bake.addColorStop(1, "#a65f2b");
  ctx.fillStyle = bake;
  ctx.fill();
  ctx.lineWidth = 0.03;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(122,66,28,0.55)";
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.lineCap = "round";
  for (let k = 1; k < LAYERS; k += 1) {
    const u = k / LAYERS;
    const [ix, iy] = croissantEdge(u, -1.2, cx);
    const [ox, oy] = croissantEdge(u, 1.2, cx);
    const [mx, my] = croissantEdge(u + (u < 0.5 ? 0.07 : -0.07), 0, cx);
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = "rgba(140,76,32,0.55)";
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.quadraticCurveTo(mx, my, ox, oy);
    ctx.stroke();
    ctx.lineWidth = 0.025;
    ctx.strokeStyle = "rgba(255,236,190,0.45)";
    ctx.beginPath();
    ctx.moveTo(ix - 0.03, iy - 0.03);
    ctx.quadraticCurveTo(mx - 0.03, my - 0.03, ox - 0.03, oy - 0.03);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,250,235,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx + BEND * 0.8, -BEND * 0.45, 0.22, 0.07, -0.9, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
