import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { DAY, themeAt } from "../../site/js/sky/palette.js";
import { STORAGE_KEY, createThemeWriter } from "../../site/js/sky/theme.js";
import { CALM } from "../../site/js/sky/weather.js";

function fakeRoot(initial = {}) {
  const props = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    props,
    style: {
      colorScheme: "",
      setProperty(name, value) {
        writes.push([name, value]);
        props.set(name, value);
      },
      getPropertyValue(name) {
        return props.get(name) ?? "";
      },
    },
  };
}

function fakeTimers() {
  const queue = [];
  const timers = {
    time: 0,
    raf: (fn) => queue.push(fn),
    now: () => timers.time,
    advance(ms) {
      timers.time += ms;
      const due = queue.splice(0);
      for (const fn of due) fn();
    },
  };
  return timers;
}

let root;
beforeEach(() => {
  root = fakeRoot(Object.fromEntries(Object.entries(DAY).map(([k, v]) => [`--${k}`, ` ${v}`])));
  globalThis.getComputedStyle = (el) => el.style;
});

const noon = themeAt({ altitude: 1, morning: false }, CALM);
const golden = themeAt({ altitude: 0.1, morning: false }, CALM);
const midnight = themeAt({ altitude: -1, morning: false }, CALM);

describe("createThemeWriter", () => {
  test("reads the current palette from CSS and skips no-op writes", () => {
    const theme = createThemeWriter(root, { animate: false });
    theme.set(noon);
    assert.equal(root.writes.length, 0);
    assert.deepEqual(theme.current(), DAY);
  });

  test("slow drift is written straight away, only for changed variables", () => {
    const theme = createThemeWriter(root, { animate: true, raf: () => assert.fail("no tween") });
    theme.set(golden);
    const changed = Object.keys(golden.vars).filter((k) => golden.vars[k] !== DAY[k]);
    assert.equal(root.writes.length, changed.length);
    theme.set(golden);
    assert.equal(root.writes.length, changed.length);
  });

  test("sunset flips the theme with a tween, and darkness follows", () => {
    const timers = fakeTimers();
    const theme = createThemeWriter(root, { raf: timers.raf, now: timers.now });
    theme.set(midnight);
    assert.equal(root.style.colorScheme, "dark");
    assert.equal(theme.transitioning(), true);
    assert.equal(theme.darkness(), 0);

    timers.advance(700);
    const halfway = theme.darkness();
    assert.ok(halfway > 0.2 && halfway < 0.8, `darkness ${halfway}`);
    assert.notEqual(theme.current().paper, DAY.paper);
    assert.notEqual(theme.current().paper, midnight.vars.paper);

    timers.advance(800);
    assert.equal(theme.transitioning(), false);
    assert.equal(theme.darkness(), 1);
    assert.deepEqual(theme.current(), midnight.vars);
    assert.equal(root.props.get("--paper"), midnight.vars.paper);
  });

  test("a new target mid-tween retargets without restarting", () => {
    const timers = fakeTimers();
    const theme = createThemeWriter(root, { raf: timers.raf, now: timers.now });
    theme.set(midnight);
    timers.advance(700);
    const later = themeAt({ altitude: -0.9, morning: false }, CALM);
    theme.set(later);
    timers.advance(800);
    assert.deepEqual(theme.current(), later.vars);
  });

  test("reduced motion snaps", () => {
    const theme = createThemeWriter(root, { animate: false });
    theme.set(midnight);
    assert.deepEqual(theme.current(), midnight.vars);
    assert.equal(theme.darkness(), 1);
  });

  test("starts dark when the boot script restored a night palette", () => {
    root.style.colorScheme = "dark";
    for (const [k, v] of Object.entries(midnight.vars)) root.props.set(`--${k}`, v);
    const theme = createThemeWriter(root, { raf: () => assert.fail("no tween") });
    assert.equal(theme.darkness(), 1);
    theme.set(midnight);
    assert.equal(root.writes.length, 0);
  });

  test("ignores malformed CSS values", () => {
    root.props.set("--paper", "red");
    assert.equal(createThemeWriter(root).current().paper, DAY.paper);
  });

  test("persists for the next visit, throttled", () => {
    const saved = [];
    const storage = { setItem: (key, value) => saved.push([key, JSON.parse(value)]) };
    let wall = 1_000_000;
    const theme = createThemeWriter(root, { animate: false, storage, wallClock: () => wall });
    theme.set(golden);
    theme.set(noon);
    assert.equal(saved.length, 1);
    assert.equal(saved[0][0], STORAGE_KEY);
    assert.deepEqual(saved[0][1], { at: 1_000_000, vars: golden.vars, scheme: "light" });
    wall += 10_001;
    theme.set(midnight);
    assert.equal(saved.length, 2);
    assert.equal(saved[1][1].scheme, "dark");
  });

  test("storage failures are harmless", () => {
    const storage = {
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    const theme = createThemeWriter(root, { animate: false, storage });
    assert.doesNotThrow(() => theme.set(midnight));
  });
});
