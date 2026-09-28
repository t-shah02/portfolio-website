import { DAY, THEME_KEYS, mixAll, paletteDistance } from "./palette.js";

export const STORAGE_KEY = "sky-theme";
const TWEEN_MS = 1400;
// Smaller shifts (the slow drift through the day) are written straight away.
const TWEEN_ABOVE = 40;
const SAVE_EVERY_MS = 10_000;
const HEX = /^#[0-9a-f]{6}$/i;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function initialVars(root) {
  const style = getComputedStyle(root);
  const vars = {};
  for (const key of THEME_KEYS) {
    const value = style.getPropertyValue(`--${key}`).trim();
    vars[key] = HEX.test(value) ? value.toLowerCase() : DAY[key];
  }
  return vars;
}

/**
 * Owns the page's colour custom properties. Only touches the DOM when a value
 * actually changes, because every write restyles the whole document.
 */
export function createThemeWriter(root, options = {}) {
  const {
    storage = null,
    animate = true,
    raf = (fn) => requestAnimationFrame(fn),
    now = () => performance.now(),
    wallClock = () => Date.now(),
  } = options;

  let current = initialVars(root);
  let darkness = root.style.colorScheme === "dark" ? 1 : 0;
  const written = { ...current };
  let tween = null;
  let savedAt = -Infinity;

  const write = (vars) => {
    for (const key of THEME_KEYS) {
      if (written[key] === vars[key]) continue;
      root.style.setProperty(`--${key}`, vars[key]);
      written[key] = vars[key];
    }
  };

  const persist = (vars, scheme) => {
    if (!storage || wallClock() - savedAt < SAVE_EVERY_MS) return;
    savedAt = wallClock();
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ at: savedAt, vars, scheme }));
    } catch {
      // Private mode or a full quota: the next visit just fades in instead.
    }
  };

  const step = () => {
    if (!tween) return;
    const t = Math.min(1, (now() - tween.start) / TWEEN_MS);
    const k = ease(t);
    current = mixAll(tween.from, tween.to, k);
    darkness = tween.fromDark + (tween.toDark - tween.fromDark) * k;
    write(current);
    if (t < 1) raf(step);
    else tween = null;
  };

  function set({ vars, scheme }) {
    const toDark = scheme === "dark" ? 1 : 0;
    if (root.style.colorScheme !== scheme) root.style.colorScheme = scheme;
    if (tween) {
      tween.to = vars;
      tween.toDark = toDark;
    } else if (animate && (darkness !== toDark || paletteDistance(current, vars) > TWEEN_ABOVE)) {
      tween = { from: current, to: vars, fromDark: darkness, toDark, start: now() };
      raf(step);
    } else {
      current = vars;
      darkness = toDark;
      write(vars);
    }
    persist(vars, scheme);
  }

  return {
    set,
    current: () => current,
    darkness: () => darkness,
    transitioning: () => tween !== null,
  };
}
