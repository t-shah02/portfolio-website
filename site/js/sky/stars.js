import { TAU, between } from "./math.js";
import { rgba } from "./palette.js";

const STAR = "#fff4dc";

export function createStars(count, random) {
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random() ** 1.6 * 0.78,
    r: between(random, 0.45, 1.5),
    speed: between(random, 0.6, 2.2),
    phase: random() * TAU,
    sparkle: random() < 0.06,
  }));
}

function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export function drawStars(ctx, stars, { width, height, t, alpha, offsetY = 0 }) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.fillStyle = STAR;
  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(t * star.speed + star.phase);
    ctx.globalAlpha = alpha * twinkle;
    const x = star.x * width;
    const y = star.y * height + offsetY;
    if (star.sparkle) {
      sparkle(ctx, x, y, star.r * 3.2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** An occasional shooting star on clear nights. */
export function createMeteor(random) {
  return { random, wait: between(random, 8, 25), active: null };
}

export function stepMeteor(meteor, dt, width, height, enabled) {
  if (meteor.active) {
    meteor.active.life += dt;
    if (meteor.active.life >= meteor.active.duration) meteor.active = null;
    return;
  }
  if (!enabled) return;
  meteor.wait -= dt;
  if (meteor.wait > 0) return;
  const { random } = meteor;
  const direction = random() < 0.5 ? -1 : 1;
  meteor.active = {
    x: between(random, 0.2, 0.8) * width,
    y: between(random, 0.05, 0.3) * height,
    vx: direction * between(random, 500, 800),
    vy: between(random, 160, 280),
    life: 0,
    duration: between(random, 0.7, 1.1),
  };
  meteor.wait = between(random, 20, 50);
}

export function drawMeteor(ctx, meteor, alpha) {
  const m = meteor.active;
  if (!m || alpha <= 0.01) return;
  const fade = Math.sin((Math.PI * m.life) / m.duration);
  const x = m.x + m.vx * m.life;
  const y = m.y + m.vy * m.life;
  const tail = 0.12;
  const gradient = ctx.createLinearGradient(x, y, x - m.vx * tail, y - m.vy * tail);
  gradient.addColorStop(0, rgba(STAR, alpha * fade));
  gradient.addColorStop(1, rgba(STAR, 0));
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - m.vx * tail, y - m.vy * tail);
  ctx.stroke();
  ctx.restore();
}
