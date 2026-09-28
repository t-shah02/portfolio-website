import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CLOUD_UNIT, cloudLayout, stepClouds } from "../../site/js/sky/clouds.js";
import { mulberry32 } from "../../site/js/sky/math.js";
import {
  createLightning,
  createRain,
  createSnow,
  flashCurve,
  stepLightning,
  stepRain,
  stepSnow,
} from "../../site/js/sky/particles.js";
import { createMeteor, createStars, stepMeteor } from "../../site/js/sky/stars.js";

const W = 1920;
const H = 1080;
const flat = (layers) => layers.flat();

describe("rain", () => {
  test("splits drops across three depth layers", () => {
    const rain = createRain(520, W, H, mulberry32(1));
    assert.equal(rain.length, 3);
    assert.equal(flat(rain).length, 520);
  });

  test("drops recycle forever and stay near the viewport, whatever the wind", () => {
    for (const wind of [-1, 0, 1]) {
      const random = mulberry32(2);
      const rain = createRain(300, W, H, random);
      for (let i = 0; i < 1200; i += 1) stepRain(rain, 1 / 60, W, H, wind, random);
      assert.equal(flat(rain).length, 300);
      for (const drop of flat(rain)) {
        assert.ok(drop.y >= -drop.length - H * 0.1 && drop.y - drop.length <= H, `y ${drop.y}`);
        assert.ok(drop.x > -W && drop.x < 2 * W, `x ${drop.x}`);
      }
    }
  });

  test("falls down and leans with the wind", () => {
    const random = mulberry32(3);
    const rain = createRain(3, W, H, random);
    const before = flat(rain).map((d) => ({ ...d }));
    stepRain(rain, 0.01, W, H, 1, random);
    flat(rain).forEach((drop, i) => {
      assert.ok(drop.y > before[i].y);
      assert.ok(drop.x > before[i].x);
    });
  });
});

describe("snow", () => {
  test("flakes wrap horizontally and recycle at the bottom", () => {
    for (const wind of [-1, 1]) {
      const random = mulberry32(4);
      const snow = createSnow(200, W, H, random);
      for (let i = 0; i < 3000; i += 1) stepSnow(snow, 1 / 60, i / 60, W, H, wind, random);
      for (const flake of flat(snow)) {
        assert.ok(flake.x >= -10 && flake.x <= W + 10, `x ${flake.x}`);
        assert.ok(flake.y <= H + flake.r, `y ${flake.y}`);
        assert.ok(flake.r > 0);
      }
    }
  });
});

describe("lightning", () => {
  test("flash curve stays soft and ends", () => {
    for (let age = 0; age < 2; age += 0.005) {
      const value = flashCurve(age);
      assert.ok(value >= 0 && value <= 0.2 + 1e-9, `age ${age}: ${value}`);
    }
    assert.equal(flashCurve(0.95), 0);
    assert.equal(flashCurve(Infinity), 0);
  });

  test("never flashes without thunder, including on the first frame", () => {
    const state = createLightning(mulberry32(5));
    for (let i = 0; i < 60 * 60; i += 1) {
      stepLightning(state, 1 / 60, 0, W, H);
      assert.equal(state.flash, 0);
    }
  });

  test("storms strike repeatedly, but no faster than every six seconds", () => {
    const state = createLightning(mulberry32(6));
    const strikes = [];
    for (let i = 0; i < 60 * 120; i += 1) {
      const before = state.age;
      stepLightning(state, 1 / 60, 1, W, H);
      if (state.age < before) strikes.push(i / 60);
    }
    assert.ok(strikes.length >= 6, `${strikes.length} strikes`);
    for (let i = 1; i < strikes.length; i += 1) assert.ok(strikes[i] - strikes[i - 1] >= 6 - 1e-6);
  });

  test("bolts stay inside the upper sky", () => {
    const state = createLightning(mulberry32(7));
    let bolts = 0;
    for (let i = 0; i < 60 * 300; i += 1) {
      stepLightning(state, 1 / 60, 1, W, H);
      if (state.age === 1 / 60 && state.bolt) {
        bolts += 1;
        for (const [, y] of state.bolt) assert.ok(y >= 0 && y <= H * 0.6 + 1e-9);
      }
    }
    assert.ok(bolts > 0);
  });
});

describe("clouds", () => {
  test("layout is deterministic for a seed", () => {
    assert.deepEqual(cloudLayout(8, mulberry32(9)), cloudLayout(8, mulberry32(9)));
  });

  test("near clouds are bigger and faster than far ones", () => {
    const clouds = cloudLayout(12, mulberry32(10));
    assert.equal(clouds.length, 12);
    assert.equal(clouds[0].depth, 0);
    assert.equal(clouds[11].depth, 1);
    assert.ok(clouds[11].scale > clouds[0].scale);
    for (const cloud of clouds) {
      assert.ok(cloud.y > 0 && cloud.y < 0.65);
      assert.ok(cloud.puffs.length >= 5);
      for (const puff of cloud.puffs) assert.ok(puff.r > 0);
    }
  });

  test("single cloud has a defined depth", () => {
    assert.equal(cloudLayout(1, mulberry32(1))[0].depth, 0.5);
  });

  test("drift wraps around both edges", () => {
    for (const wind of [-1, 1]) {
      const clouds = cloudLayout(6, mulberry32(11));
      for (let i = 0; i < 60 * 600; i += 1) stepClouds(clouds, 1 / 60, W, wind);
      for (const cloud of clouds) {
        const margin = (CLOUD_UNIT * cloud.scale * 1.25) / W;
        assert.ok(cloud.x >= -margin - 1e-9 && cloud.x <= 1 + margin + 1e-9, `x ${cloud.x}`);
      }
    }
  });
});

describe("stars and meteors", () => {
  test("stars live in the upper sky", () => {
    for (const star of createStars(300, mulberry32(12))) {
      assert.ok(star.x >= 0 && star.x < 1);
      assert.ok(star.y >= 0 && star.y <= 0.78);
      assert.ok(star.r > 0);
    }
  });

  test("meteors only fly when enabled, and burn out", () => {
    const meteor = createMeteor(mulberry32(13));
    for (let i = 0; i < 60 * 120; i += 1) stepMeteor(meteor, 1 / 60, W, H, false);
    assert.equal(meteor.active, null);
    let seen = 0;
    for (let i = 0; i < 60 * 120; i += 1) {
      stepMeteor(meteor, 1 / 60, W, H, true);
      if (meteor.active && meteor.active.life === 0) seen += 1;
    }
    assert.ok(seen >= 2, `${seen} meteors`);
    for (let i = 0; i < 120; i += 1) stepMeteor(meteor, 1 / 60, W, H, false);
    assert.equal(meteor.active, null);
  });
});
