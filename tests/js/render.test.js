import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { drawMoon, drawSun } from "../../site/js/sky/bodies.js";
import { cloudLayout, drawClouds, renderCloud } from "../../site/js/sky/clouds.js";
import { mulberry32 } from "../../site/js/sky/math.js";
import { DAY, themeAt } from "../../site/js/sky/palette.js";
import { createLightning, createRain, createSnow, drawFog, drawLightning, drawRain, drawSnow, stepLightning } from "../../site/js/sky/particles.js";
import { createScene, pixelRatio, quantize } from "../../site/js/sky/scene.js";
import { createStars, drawStars } from "../../site/js/sky/stars.js";
import { CALM } from "../../site/js/sky/weather.js";
import { count, fakeCanvas, fakeContext } from "./fake-canvas.js";

describe("bodies", () => {
  test("the latte sun draws its halo, saucer, cup, crema and art", () => {
    const ctx = fakeContext();
    drawSun(ctx, { x: 500, y: 300, r: 48, t: 12.5, warmth: 0.4, alpha: 0.9 });
    assert.ok(count(ctx.calls, "arc") >= 5);
    assert.ok(count(ctx.calls, "bezierCurveTo") >= 8, "rosetta hearts");
    assert.equal(count(ctx.calls, "save"), count(ctx.calls, "restore"));
    assert.ok(count(ctx.calls, "clip") >= 1, "latte art stays inside the cup");
  });

  test("the croissant moon draws a crescent with rolled layers, flipped when waning", () => {
    for (const waxing of [true, false]) {
      const ctx = fakeContext();
      drawMoon(ctx, { x: 500, y: 300, r: 46, t: 3, alpha: 1, waxing });
      assert.ok(count(ctx.calls, "lineTo") >= 90, "smooth silhouette");
      assert.equal(count(ctx.calls, "quadraticCurveTo"), 8, "four seams, each with a highlight");
      assert.ok(ctx.calls.includes("clip"), "seams stay inside the pastry");
      assert.equal(count(ctx.calls, "save"), count(ctx.calls, "restore"));
      assert.ok(ctx.calls.includes("scale"));
    }
  });

  test("invisible bodies cost nothing", () => {
    const ctx = fakeContext();
    drawSun(ctx, { x: 0, y: 0, r: 40, t: 0, alpha: 0 });
    drawMoon(ctx, { x: 0, y: 0, r: 40, t: 0, alpha: 0 });
    assert.equal(ctx.calls.length, 0);
  });

  test("extreme warmth and time values stay valid", () => {
    for (const warmth of [0, 1]) {
      for (const t of [0, 1e6]) drawSun(fakeContext(), { x: 1, y: 1, r: 30, t, warmth, alpha: 1 });
    }
  });
});

describe("layers", () => {
  test("stars skip entirely by day", () => {
    const ctx = fakeContext();
    drawStars(ctx, createStars(50, mulberry32(1)), { width: 800, height: 600, t: 0, alpha: 0 });
    assert.equal(ctx.calls.length, 0);
  });

  test("stars draw one shape each at night", () => {
    const ctx = fakeContext();
    const stars = createStars(50, mulberry32(1));
    drawStars(ctx, stars, { width: 800, height: 600, t: 4, alpha: 1 });
    assert.equal(count(ctx.calls, "fill"), 50);
  });

  test("rain and snow batch into one draw call per depth layer", () => {
    const random = mulberry32(2);
    const rainCtx = fakeContext();
    drawRain(rainCtx, createRain(300, 800, 600, random), "#6b7a90", 0.4);
    assert.equal(count(rainCtx.calls, "stroke"), 3);
    const snowCtx = fakeContext();
    drawSnow(snowCtx, createSnow(300, 800, 600, random), "#ffffff");
    assert.equal(count(snowCtx.calls, "fill"), 3);
  });

  test("fog only draws when present", () => {
    const ctx = fakeContext();
    drawFog(ctx, { width: 800, height: 600, t: 1, fog: 0, color: "#eee8e0" });
    assert.equal(ctx.calls.length, 0);
    drawFog(ctx, { width: 800, height: 600, t: 1, fog: 0.8, color: "#eee8e0" });
    assert.equal(count(ctx.calls, "fill"), 3);
  });

  test("lightning flash overlay", () => {
    const state = createLightning(mulberry32(3));
    state.wait = 0;
    stepLightning(state, 0.05, 1, 800, 600);
    stepLightning(state, 0.05, 1, 800, 600);
    const ctx = fakeContext();
    drawLightning(ctx, state, 800, 600);
    assert.ok(ctx.calls.includes("fillRect"));
  });

  test("cloud sprites render with a flat base and blit per cloud", () => {
    const clouds = cloudLayout(4, mulberry32(4));
    const sprites = clouds.map((cloud) =>
      renderCloud(cloud, { light: "#fffaf3", shade: "#dcd3ca" }, 1.5, (w, h) => fakeCanvas(w, h)),
    );
    for (const sprite of sprites) {
      assert.ok(sprite.width > 0 && sprite.height > 0);
      assert.equal(sprite.canvas.width, Math.ceil(sprite.width * 1.5));
      assert.equal(sprite.canvas.context.globalCompositeOperation, "destination-out");
    }
    const ctx = fakeContext();
    drawClouds(ctx, clouds, sprites, { width: 1920, height: 1080, cloudiness: 0.7 });
    assert.equal(count(ctx.calls, "drawImage"), 4);
  });
});

describe("scene helpers", () => {
  test("pixel ratio caps huge screens", () => {
    assert.equal(pixelRatio(1920, 1080, 1), 1);
    assert.equal(pixelRatio(1024, 768, 2), 2);
    assert.ok(Math.abs(pixelRatio(1280, 800, 2) * 1280 * pixelRatio(1280, 800, 2) * 800 - 3_200_000) < 1);
    assert.ok(pixelRatio(3840, 2160, 2) < 1);
    assert.ok(pixelRatio(3840, 2160, 2) >= 0.75);
    assert.equal(pixelRatio(1920, 1080, undefined), 1);
    assert.equal(pixelRatio(800, 600, 4), 2);
  });

  test("quantize snaps to a grid", () => {
    assert.equal(quantize("#010203"), "#000006");
    assert.equal(quantize("#fffefd"), "#fffcfc");
    assert.equal(quantize("#ffffff"), "#ffffff", "rounding up past 255 clamps");
    assert.equal(quantize(quantize("#7a7b7c")), quantize("#7a7b7c"));
  });
});

function fakeWindow() {
  const listeners = new Map();
  const frames = [];
  const win = {
    innerHeight: 1080,
    innerWidth: 1920,
    scrollY: 0,
    devicePixelRatio: 1,
    document: { documentElement: { clientWidth: 1920, scrollHeight: 4000 } },
    performance: { now: () => 0 },
    listeners,
    frames,
    requestAnimationFrame: (fn) => frames.push(fn),
    cancelAnimationFrame: () => {
      frames.length = 0;
    },
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: () => 2,
    clearInterval: () => {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  return win;
}

function fakeTheme() {
  let darkness = 0;
  const sets = [];
  return {
    sets,
    set: (value) => {
      sets.push(value);
      darkness = value.scheme === "dark" ? 1 : 0;
    },
    current: () => DAY,
    darkness: () => darkness,
  };
}

describe("createScene", () => {
  let realDocument;
  beforeEach(() => {
    realDocument = globalThis.document;
    globalThis.document = { createElement: () => fakeCanvas() };
  });
  afterEach(() => {
    globalThis.document = realDocument;
  });

  const weathers = {
    clear: CALM,
    storm: { ...CALM, cloud: 1, rain: 1, thunder: 1, wind: 0.5 },
    blizzard: { ...CALM, cloud: 1, snow: 1, wind: -0.8 },
    fog: { ...CALM, cloud: 0.7, fog: 0.8 },
  };

  for (const [name, weather] of Object.entries(weathers)) {
    for (const hour of [0, 6.5, 12, 19.2]) {
      test(`${name} at ${hour}h renders a full minute without invalid draw calls`, () => {
        const win = fakeWindow();
        const canvas = fakeCanvas();
        const theme = fakeTheme();
        const date = new Date(2026, 8, 27);
        date.setMinutes(hour * 60);
        const scene = createScene(canvas, { weather, latitude: 51, now: () => date, theme, win });
        scene.start();
        assert.equal(canvas.width, 1920);
        assert.equal(canvas.height, 1080);
        let time = 0;
        for (let i = 0; i < 60 * 60 && win.frames.length; i += 1) {
          time += 1000 / 60;
          win.frames.shift()(time);
        }
        assert.ok(scene.state.t > 55, `simulated ${scene.state.t}s`);
        assert.ok(canvas.context.calls.includes("fillRect"));
        assert.ok(theme.sets.length >= 10, "theme refreshed periodically");
        scene.stop();
        assert.equal(win.listeners.size, 0);
      });
    }
  }

  test("scrolling moves the sun but keeps it on screen", () => {
    const win = fakeWindow();
    const scene = createScene(fakeCanvas(), {
      weather: CALM,
      latitude: 51,
      now: () => new Date(2026, 8, 27, 13, 0),
      theme: fakeTheme(),
      win,
    });
    scene.start();
    assert.equal(scene.state.scroll, 0);
    win.scrollY = 2920;
    win.listeners.get("scroll")();
    assert.equal(scene.state.scroll, 1);
    scene.stop();
  });

  test("resize rebuilds for the new viewport", () => {
    const win = fakeWindow();
    const canvas = fakeCanvas();
    const scene = createScene(canvas, { weather: weathers.storm, latitude: 51, now: () => new Date(), theme: fakeTheme(), win });
    scene.start();
    const drops = scene.state.rain.flat().length;
    win.document.documentElement.clientWidth = 1280;
    win.innerHeight = 720;
    win.listeners.get("resize")();
    assert.equal(canvas.width, 1280);
    assert.ok(scene.state.rain.flat().length < drops);
    scene.stop();
  });

  test("reduced motion paints a still frame and never animates", () => {
    const win = fakeWindow();
    const canvas = fakeCanvas();
    const scene = createScene(canvas, {
      weather: weathers.storm,
      latitude: 51,
      now: () => new Date(),
      theme: fakeTheme(),
      reducedMotion: true,
      win,
    });
    scene.start();
    assert.equal(win.frames.length, 0);
    assert.ok(canvas.context.calls.includes("fillRect"));
    assert.equal(win.listeners.has("scroll"), false);
    scene.stop();
  });

  test("calm skies run at 30 fps", () => {
    const win = fakeWindow();
    const scene = createScene(fakeCanvas(), { weather: CALM, latitude: 51, now: () => new Date(), theme: fakeTheme(), win });
    scene.start();
    let time = 0;
    let before = scene.state.t;
    let updates = 0;
    for (let i = 0; i < 60; i += 1) {
      time += 1000 / 60;
      win.frames.shift()(time);
      if (scene.state.t !== before) updates += 1;
      before = scene.state.t;
    }
    assert.ok(updates >= 28 && updates <= 32, `${updates} updates in one second`);
    scene.stop();
  });

  test("night theme reaches the sky renderer", () => {
    const theme = fakeTheme();
    const win = fakeWindow();
    const scene = createScene(fakeCanvas(), {
      weather: CALM,
      latitude: 51,
      now: () => new Date(2026, 8, 27, 1, 0),
      theme,
      win,
    });
    scene.start();
    win.frames.shift()(100);
    assert.equal(theme.sets.at(-1).scheme, themeAt(scene.state.clock, CALM).scheme);
    assert.equal(theme.sets.at(-1).scheme, "dark");
    scene.stop();
  });
});
