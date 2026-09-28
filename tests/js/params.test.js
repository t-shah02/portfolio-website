import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PRESETS, makeClock, parseSkyParams, parseTime, parseWeather } from "../../site/js/sky/params.js";

describe("parseTime", () => {
  test("accepts clock and decimal forms", () => {
    assert.equal(parseTime("21:30"), 21.5);
    assert.equal(parseTime("7:05"), 7 + 5 / 60);
    assert.equal(parseTime("0"), 0);
    assert.equal(parseTime("18.25"), 18.25);
    assert.equal(parseTime("23:59"), 23 + 59 / 60);
  });

  test("rejects nonsense", () => {
    for (const value of ["", "24", "24:00", "7:60", "-1", "noon", "12:3", "1e1", "12:30:00"]) {
      assert.equal(parseTime(value), undefined, value);
    }
  });
});

describe("parseWeather", () => {
  test("presets", () => {
    assert.deepEqual(parseWeather("storm"), PRESETS.storm);
    assert.deepEqual(parseWeather("clear"), PRESETS.clear);
  });

  test("keys after a preset override it", () => {
    assert.deepEqual(parseWeather("rain,cloud:0.3"), { ...PRESETS.rain, cloud: 0.3 });
  });

  test("clamps and ignores unknown or broken pairs", () => {
    assert.deepEqual(parseWeather("snow:4,wind:-3,lava:1,rain:,fog:abc,thunder:0.5"), { snow: 1, wind: -1, thunder: 0.5 });
  });

  test("unknown preset names are ignored", () => {
    assert.deepEqual(parseWeather("hurricane"), {});
  });
});

describe("parseSkyParams", () => {
  test("no overrides", () => {
    assert.deepEqual(parseSkyParams(""), { weather: {} });
    assert.deepEqual(parseSkyParams("?utm_source=x"), { weather: {} });
  });

  test("full preview", () => {
    assert.deepEqual(parseSkyParams("?sky-time=21:30&sky-speed=600&sky-weather=snow&sky-lat=64"), {
      time: 21.5,
      speed: 600,
      lat: 64,
      weather: PRESETS.snow,
    });
  });

  test("invalid values are dropped", () => {
    assert.deepEqual(parseSkyParams("?sky-time=25:00&sky-speed=-4&sky-lat=100&sky-weather="), { weather: {} });
    assert.deepEqual(parseSkyParams("?sky-speed=abc&sky-lat="), { weather: {} });
  });

  test("speed is capped", () => {
    assert.equal(parseSkyParams("?sky-speed=1e9").speed, 100_000);
  });
});

describe("makeClock", () => {
  test("no overrides is the real clock", () => {
    let t = 1_700_000_000_000;
    const clock = makeClock({}, () => t);
    assert.equal(clock().getTime(), t);
    t += 5000;
    assert.equal(clock().getTime(), t);
  });

  test("time override pins today's local hour and keeps ticking", () => {
    let t = new Date(2026, 8, 27, 10, 0).getTime();
    const clock = makeClock({ time: 21.5 }, () => t);
    assert.equal(clock().getHours(), 21);
    assert.equal(clock().getMinutes(), 30);
    assert.equal(clock().getDate(), 27);
    t += 60_000;
    assert.equal(clock().getMinutes(), 31);
  });

  test("speed fast-forwards the cycle", () => {
    let t = new Date(2026, 8, 27, 6, 0).getTime();
    const clock = makeClock({ time: 6, speed: 3600 }, () => t);
    t += 1000;
    assert.equal(clock().getHours(), 7);
  });
});
