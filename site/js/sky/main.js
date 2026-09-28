import { skyClock } from "./clock.js";
import { themeAt } from "./palette.js";
import { makeClock, parseSkyParams } from "./params.js";
import { createThemeWriter } from "./theme.js";
import { normalizeWeather } from "./weather.js";

function serverWeather() {
  try {
    return JSON.parse(document.getElementById("sky-data")?.textContent || "null");
  } catch {
    return null;
  }
}

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot() {
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = parseSkyParams(location.search);
  const weather = normalizeWeather({ ...serverWeather(), ...params.weather });
  const latitude = params.lat ?? weather.lat ?? undefined;
  const now = makeClock(params);
  const preview = params.time !== undefined || params.speed !== undefined || Object.keys(params.weather).length > 0;

  // Recolour the page before the renderer downloads, so the palette lands with first paint.
  const theme = createThemeWriter(root, { storage: preview ? null : localStore(), animate: !reducedMotion });
  theme.set(themeAt(skyClock(now(), latitude), weather));

  const { createScene } = await import("./scene.js");
  const canvas = document.createElement("canvas");
  canvas.className = "sky-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  try {
    const scene = createScene(canvas, {
      weather,
      latitude,
      now,
      theme,
      reducedMotion,
      themeEvery: (params.speed ?? 1) > 1 ? 200 : 5000,
    });
    scene.start();
  } catch (error) {
    canvas.remove();
    throw error;
  }
  requestAnimationFrame(() => canvas.classList.add("is-ready"));
}

boot().catch((error) => {
  document.documentElement.classList.remove("sky");
  console.error("sky:", error);
});
