import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CALM, areaScale, frameInterval, normalizeWeather, particleBudget } from "../../site/js/sky/weather.js";

describe("normalizeWeather", () => {
  test("missing or garbage payloads are calm", () => {
    for (const raw of [null, undefined, "rain", 42, [], {}]) assert.deepEqual(normalizeWeather(raw), CALM);
  });

  test("passes through the server shape", () => {
    const raw = { cloud: 0.8, rain: 0.6, snow: 0, fog: 0.1, thunder: 0, wind: -0.25, code: 63, lat: 51 };
    assert.deepEqual(normalizeWeather(raw), { cloud: 0.8, rain: 0.6, snow: 0, fog: 0.1, thunder: 0, wind: -0.25, lat: 51 });
  });

  test("clamps and rejects non-numbers", () => {
    const weather = normalizeWeather({ cloud: 7, rain: -1, snow: "0.5", fog: NaN, thunder: Infinity, wind: -9, lat: 200 });
    assert.deepEqual(weather, { cloud: 1, rain: 0, snow: 0.5, fog: 0, thunder: 0, wind: -1, lat: null });
  });

  test("null latitude stays null rather than becoming the equator", () => {
    assert.equal(normalizeWeather({ lat: null }).lat, null);
    assert.equal(normalizeWeather({ lat: 0 }).lat, 0);
  });
});

describe("particleBudget", () => {
  test("clear sky draws nothing but stars", () => {
    const budget = particleBudget(CALM, 1920, 1080);
    assert.deepEqual({ ...budget, stars: 0 }, { rain: 0, snow: 0, clouds: 0, stars: 0 });
    assert.ok(budget.stars > 100);
  });

  test("full intensity on a 1080p screen", () => {
    const budget = particleBudget({ ...CALM, cloud: 1, rain: 1, snow: 1 }, 1920, 1080);
    assert.equal(budget.rain, 520);
    assert.equal(budget.snow, 340);
    assert.equal(budget.clouds, 15);
  });

  test("grows monotonically with intensity", () => {
    let previous = { rain: -1, snow: -1, clouds: -1 };
    for (let i = 0; i <= 1.0001; i += 0.05) {
      const budget = particleBudget({ ...CALM, cloud: i, rain: i, snow: i }, 1920, 1080);
      for (const key of ["rain", "snow", "clouds"]) assert.ok(budget[key] >= previous[key], key);
      previous = budget;
    }
  });

  test("a wisp of cloud still shows one cloud", () => {
    assert.equal(particleBudget({ ...CALM, cloud: 0.06 }, 1920, 1080).clouds, 1);
    assert.equal(particleBudget({ ...CALM, cloud: 0.04 }, 1920, 1080).clouds, 0);
  });

  test("scales with screen area and caps on giant displays", () => {
    const storm = { ...CALM, rain: 1 };
    assert.ok(particleBudget(storm, 1280, 720).rain < particleBudget(storm, 1920, 1080).rain);
    assert.equal(particleBudget(storm, 7680, 4320).rain, Math.round(520 * 1.6));
    assert.equal(areaScale(100, 100), 0.4);
  });
});

describe("frameInterval", () => {
  test("30 fps for calm skies, 60 fps for precipitation", () => {
    assert.equal(frameInterval(CALM), 1000 / 30);
    assert.equal(frameInterval({ ...CALM, cloud: 1, fog: 1 }), 1000 / 30);
    assert.equal(frameInterval({ ...CALM, rain: 0.1 }), 1000 / 60);
    assert.equal(frameInterval({ ...CALM, snow: 0.1 }), 1000 / 60);
    assert.equal(frameInterval({ ...CALM, thunder: 0.1 }), 1000 / 60);
  });
});
