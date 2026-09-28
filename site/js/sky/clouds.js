import { TAU, between } from "./math.js";
import { mix } from "./palette.js";

// A cloud's width in CSS pixels at scale 1.
export const CLOUD_UNIT = 240;

/** Cloud shapes and places, in viewport-relative units. Deeper clouds are bigger, nearer and faster. */
export function cloudLayout(count, random) {
  return Array.from({ length: count }, (_, index) => {
    const depth = count > 1 ? index / (count - 1) : 0.5;
    const puffCount = 5 + Math.floor(random() * 4);
    const puffs = Array.from({ length: puffCount }, (_, i) => {
      const along = i / (puffCount - 1);
      return {
        dx: -0.42 + along * 0.84 + between(random, -0.04, 0.04),
        dy: between(random, -0.06, 0.02),
        r: (0.13 + 0.17 * Math.sin(Math.PI * along)) * between(random, 0.8, 1.2),
      };
    });
    return {
      x: random(),
      y: between(random, 0.04, 0.5) + depth * 0.08,
      depth,
      scale: 0.7 + depth * 0.9 + between(random, -0.1, 0.1),
      speed: 4 + depth * 12 + random() * 4,
      puffs,
    };
  });
}

/** Rendered once per cloud and colour, then blitted each frame. */
export function renderCloud(cloud, colors, pixelRatio, createCanvas) {
  const unit = CLOUD_UNIT * cloud.scale;
  const width = Math.ceil(unit * 1.25);
  const height = Math.ceil(unit * 0.7);
  const canvas = createCanvas(Math.ceil(width * pixelRatio), Math.ceil(height * pixelRatio));
  const ctx = canvas.getContext("2d");
  ctx.scale(pixelRatio, pixelRatio);
  const cx = width / 2;
  const base = height * 0.72;
  const middle = mix(colors.light, colors.shade, 0.45);

  ctx.fillStyle = colors.shade;
  for (const puff of cloud.puffs) {
    ctx.beginPath();
    ctx.arc(cx + puff.dx * unit, base + puff.dy * unit + puff.r * unit * 0.14, puff.r * unit, 0, TAU);
    ctx.fill();
  }
  for (const puff of cloud.puffs) {
    const x = cx + puff.dx * unit;
    const y = base + puff.dy * unit;
    const r = puff.r * unit;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r);
    g.addColorStop(0, colors.light);
    g.addColorStop(0.7, colors.light);
    g.addColorStop(1, middle);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.06, r * 0.94, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "destination-out";
  const flat = ctx.createLinearGradient(0, base, 0, base + unit * 0.12);
  flat.addColorStop(0, "rgba(0,0,0,0)");
  flat.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = flat;
  ctx.fillRect(0, base, width, height - base);

  return { canvas, width, height };
}

export function stepClouds(clouds, dt, width, wind) {
  for (const cloud of clouds) {
    const spriteWidth = (CLOUD_UNIT * cloud.scale * 1.25) / width;
    cloud.x += ((cloud.speed * (1 + wind * 2.5) + wind * 30) * dt) / width;
    if (cloud.x > 1 + spriteWidth) cloud.x = -spriteWidth;
    else if (cloud.x < -spriteWidth) cloud.x = 1 + spriteWidth;
  }
}

export function drawClouds(ctx, clouds, sprites, { width, height, cloudiness, offsetY = 0 }) {
  ctx.save();
  clouds.forEach((cloud, i) => {
    const sprite = sprites[i];
    if (!sprite) return;
    ctx.globalAlpha = (0.55 + 0.45 * cloud.depth) * Math.min(1, 0.45 + cloudiness);
    const x = cloud.x * width - sprite.width / 2;
    const y = cloud.y * height - sprite.height / 2 + offsetY * (0.5 + cloud.depth);
    ctx.drawImage(sprite.canvas, x, y, sprite.width, sprite.height);
  });
  ctx.restore();
}
