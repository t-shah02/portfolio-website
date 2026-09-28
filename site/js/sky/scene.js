import { moonPhase, skyClock } from "./clock.js";
import { cloudLayout, drawClouds, renderCloud, stepClouds } from "./clouds.js";
import { drawMoon, drawSun } from "./bodies.js";
import { clamp, mulberry32 } from "./math.js";
import { hexToRgb, rgbToHex, rgba, skyAt, themeAt } from "./palette.js";
import {
  createLightning,
  createRain,
  createSnow,
  drawFog,
  drawLightning,
  drawRain,
  drawSnow,
  stepLightning,
  stepRain,
  stepSnow,
} from "./particles.js";
import { arcPoint, bodyPosition, bodyRadius, horizonFade, scrollRatio, tuckAmount, tuckedRadius } from "./path.js";
import { createMeteor, createStars, drawMeteor, drawStars, stepMeteor } from "./stars.js";
import { frameInterval, particleBudget } from "./weather.js";

const MAX_PIXELS = 3_200_000;
const SEED = 0xc0ffee;
const STATIC_REDRAW_MS = 60_000;

/** Device pixel ratio, lowered on huge screens so a frame never pushes more than ~3 MP. */
export function pixelRatio(width, height, deviceRatio) {
  const cap = Math.sqrt(MAX_PIXELS / Math.max(1, width * height));
  return Math.max(0.75, Math.min(deviceRatio || 1, 2, cap));
}

/** Snap a colour to a coarse grid so cloud sprites are only re-rendered for visible changes. */
export function quantize(hex, step = 6) {
  return rgbToHex(hexToRgb(hex).map((v) => Math.round(v / step) * step));
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createScene(canvas, options) {
  const { weather, latitude, now, theme, reducedMotion = false, themeEvery = 5000, win = window } = options;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas unavailable");

  const random = mulberry32(SEED ^ Date.now());
  const interval = frameInterval(weather);
  const state = {
    width: 0,
    height: 0,
    ratio: 1,
    scroll: 0,
    tuck: 0,
    content: null,
    t: 0,
    clock: skyClock(now(), latitude),
    starsVisible: false,
    stars: [],
    clouds: [],
    sprites: [],
    spriteKey: "",
    rain: [],
    snow: [],
    meteor: createMeteor(random),
    lightning: createLightning(random),
  };
  let frame = 0;
  let last = 0;
  let lastTheme = -Infinity;
  let running = false;
  let resizeTimer = 0;
  let staticTimer = 0;

  function readScroll() {
    const doc = win.document.documentElement;
    state.scroll = scrollRatio(win.scrollY, doc.scrollHeight, win.innerHeight);
    state.tuck = tuckAmount(win.scrollY, win.innerHeight);
  }

  function readContent() {
    const box = win.document.querySelector?.("main")?.getBoundingClientRect();
    state.content = box && box.width > 0 ? { left: box.left, right: box.right } : null;
  }

  function layout() {
    const width = win.document.documentElement.clientWidth || win.innerWidth;
    const height = win.innerHeight;
    const ratio = pixelRatio(width, height, win.devicePixelRatio);
    Object.assign(state, { width, height, ratio, spriteKey: "" });
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const budget = particleBudget(weather, width, height);
    const stable = mulberry32(SEED);
    state.stars = createStars(budget.stars, stable);
    state.clouds = cloudLayout(budget.clouds, stable);
    state.rain = createRain(budget.rain, width, height, random);
    state.snow = createSnow(budget.snow, width, height, random);
    readContent();
    readScroll();
  }

  function ensureSprites(sky) {
    const colors = { light: quantize(sky.cloudLight), shade: quantize(sky.cloudShade) };
    const key = `${colors.light}|${colors.shade}`;
    if (key === state.spriteKey) return;
    state.spriteKey = key;
    state.sprites = state.clouds.map((cloud) => renderCloud(cloud, colors, state.ratio, createCanvas));
  }

  function update(dt) {
    const { width, height } = state;
    state.t += dt;
    stepClouds(state.clouds, dt, width, weather.wind);
    stepRain(state.rain, dt, width, height, weather.wind, random);
    stepSnow(state.snow, dt, state.t, width, height, weather.wind, random);
    stepLightning(state.lightning, dt, weather.thunder, width, height);
    stepMeteor(state.meteor, dt, width, height, state.starsVisible);
  }

  function draw() {
    const { width: w, height: h, t } = state;
    const date = now();
    const clock = skyClock(date, latitude);
    state.clock = clock;
    const sky = skyAt(clock, weather, theme.darkness());
    state.starsVisible = sky.stars > 0.6 && weather.cloud < 0.5;

    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, sky.zenith);
    background.addColorStop(0.62, sky.horizon);
    background.addColorStop(1, theme.current().paper);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    if (sky.glowAlpha > 0.01) {
      const at = arcPoint(clamp(clock.day, -0.05, 1.05), w, h);
      const radius = Math.max(w, h) * 0.55;
      const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
      glow.addColorStop(0, rgba(sky.glow, sky.glowAlpha));
      glow.addColorStop(1, rgba(sky.glow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    const parallax = -state.scroll * h * 0.05;
    drawStars(ctx, state.stars, { width: w, height: h, t, alpha: sky.stars, offsetY: parallax });
    drawMeteor(ctx, state.meteor, sky.stars);

    const { content, tuck, scroll } = state;
    const full = bodyRadius(w, h);
    const r = content ? tuckedRadius(full, content, w, tuck) : full;
    const placement = { width: w, height: h, scroll, tuck, content, r };
    const clearness = 1 - weather.cloud * 0.75;
    drawMoon(ctx, {
      ...bodyPosition(clock.night, placement),
      r: r * 0.95,
      t,
      alpha: horizonFade(clock.night) * clearness,
      waxing: moonPhase(date) < 0.5,
    });
    drawSun(ctx, {
      ...bodyPosition(clock.day, placement),
      r,
      t,
      warmth: sky.sunWarmth,
      alpha: horizonFade(clock.day) * clearness,
    });

    if (sky.veilAlpha > 0.01) {
      ctx.fillStyle = rgba(sky.veil, sky.veilAlpha);
      ctx.fillRect(0, 0, w, h);
    }
    ensureSprites(sky);
    drawClouds(ctx, state.clouds, state.sprites, { width: w, height: h, cloudiness: weather.cloud, offsetY: parallax });
    drawFog(ctx, { width: w, height: h, t, fog: weather.fog, color: sky.fog });
    drawRain(ctx, state.rain, sky.rain, weather.wind);
    drawSnow(ctx, state.snow, sky.snow, sky.snowEdge, 1 - theme.darkness());
    if (!reducedMotion) drawLightning(ctx, state.lightning, w, h);
  }

  function refreshTheme(time) {
    if (time - lastTheme < themeEvery) return;
    lastTheme = time;
    theme.set(themeAt(state.clock, weather));
  }

  function tick(time) {
    if (!running) return;
    frame = win.requestAnimationFrame(tick);
    if (time - last < interval - 1) return;
    const dt = Math.min((time - last) / 1000, 0.1);
    last = time;
    update(dt);
    draw();
    refreshTheme(time);
  }

  function renderStatic() {
    draw();
    refreshTheme(win.performance.now());
  }

  const onScroll = () => readScroll();
  const onResize = () => {
    win.clearTimeout(resizeTimer);
    resizeTimer = win.setTimeout(() => {
      layout();
      if (reducedMotion) renderStatic();
    }, 150);
  };

  function start() {
    if (running) return;
    running = true;
    layout();
    win.addEventListener("resize", onResize);
    if (reducedMotion) {
      renderStatic();
      staticTimer = win.setInterval(renderStatic, STATIC_REDRAW_MS);
      return;
    }
    win.addEventListener("scroll", onScroll, { passive: true });
    draw();
    frame = win.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    win.cancelAnimationFrame(frame);
    win.clearInterval(staticTimer);
    win.clearTimeout(resizeTimer);
    win.removeEventListener("resize", onResize);
    win.removeEventListener("scroll", onScroll);
  }

  return { start, stop, draw, update, state };
}
