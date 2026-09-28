import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DAY,
  NIGHT_BELOW,
  THEME_KEYS,
  contrast,
  desaturate,
  hexToRgb,
  mix,
  paletteDistance,
  rgbToHex,
  rgba,
  sampleStops,
  skyAt,
  themeAt,
} from "../../site/js/sky/palette.js";
import { CALM } from "../../site/js/sky/weather.js";

const altitudes = Array.from({ length: 81 }, (_, i) => -1 + i * 0.025);
const skies = [CALM, { ...CALM, cloud: 0.5 }, { ...CALM, cloud: 1, rain: 1, thunder: 1 }, { ...CALM, cloud: 1, snow: 1 }];

describe("colour helpers", () => {
  test("hex round trip", () => {
    for (const hex of ["#000000", "#ffffff", "#f4ecdf", "#0a0e1b"]) assert.equal(rgbToHex(hexToRgb(hex)), hex);
  });

  test("rgbToHex clamps", () => {
    assert.equal(rgbToHex([300, -5, 127.6]), "#ff0080");
  });

  test("mix endpoints and midpoint", () => {
    assert.equal(mix("#000000", "#ffffff", 0), "#000000");
    assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(mix("#000000", "#ffffff", -3), "#000000");
  });

  test("rgba", () => {
    assert.equal(rgba("#ff8000", 0.5), "rgba(255,128,0,0.5)");
    assert.equal(rgba("#ff8000", 2), "rgba(255,128,0,1)");
    assert.equal(rgba("#ff8000", 1 / 3), "rgba(255,128,0,0.333)");
  });

  test("desaturate keeps lightness roughly and removes hue", () => {
    const [r, g, b] = hexToRgb(desaturate("#ff0000", 1));
    assert.equal(r, g);
    assert.equal(g, b);
    assert.equal(desaturate("#123456", 0), "#123456");
  });

  test("contrast ratio matches WCAG", () => {
    assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
    assert.equal(contrast("#777777", "#777777"), 1);
  });

  test("sampleStops clamps and interpolates", () => {
    const stops = [
      [0, { c: "#000000", n: 0 }],
      [1, { c: "#ffffff", n: 10 }],
    ];
    assert.deepEqual(sampleStops(stops, -5), stops[0][1]);
    assert.deepEqual(sampleStops(stops, 5), stops[1][1]);
    assert.equal(sampleStops(stops, 0.5).n, 5);
  });

  test("paletteDistance", () => {
    assert.equal(paletteDistance(DAY, DAY), 0);
    assert.equal(paletteDistance(DAY, { ...DAY, ink: "#ffffff" }), 255 - 0x18);
  });
});

describe("themeAt", () => {
  test("midday clear sky is exactly the site's original palette", () => {
    assert.deepEqual(themeAt({ altitude: 1, morning: false }, CALM), { vars: DAY, scheme: "light" });
    assert.deepEqual(themeAt({ altitude: 0.5, morning: true }, CALM).vars, DAY);
  });

  test("defines every theme variable as hex", () => {
    for (const altitude of altitudes) {
      const { vars } = themeAt({ altitude, morning: false }, CALM);
      assert.deepEqual(Object.keys(vars).sort(), [...THEME_KEYS].sort());
      for (const value of Object.values(vars)) assert.match(value, /^#[0-9a-f]{6}$/);
    }
  });

  test("switches to the dark roast just after sunset", () => {
    assert.equal(themeAt({ altitude: NIGHT_BELOW, morning: false }, CALM).scheme, "light");
    assert.equal(themeAt({ altitude: NIGHT_BELOW - 0.001, morning: false }, CALM).scheme, "dark");
    assert.equal(themeAt({ altitude: -1, morning: true }, CALM).scheme, "dark");
  });

  test("text stays readable at every hour and in every weather", () => {
    for (const weather of skies) {
      for (const morning of [true, false]) {
        for (const altitude of altitudes) {
          const { vars } = themeAt({ altitude, morning }, weather);
          const where = `alt ${altitude.toFixed(3)} morning ${morning} cloud ${weather.cloud}`;
          assert.ok(contrast(vars.ink, vars.paper) >= 7, `ink/paper ${where}`);
          assert.ok(contrast(vars.ink, vars.foam) >= 7, `ink/foam ${where}`);
          assert.ok(contrast(vars["ink-soft"], vars.paper) >= 4.5, `ink-soft/paper ${where}`);
          assert.ok(contrast(vars["ink-soft"], vars["paper-deep"]) >= 4.5, `ink-soft/paper-deep ${where}`);
          assert.ok(contrast(vars.coffee, vars.foam) >= 4.5, `coffee/foam ${where}`);
          assert.ok(contrast(vars.coffee, vars["paper-deep"]) >= 4.5, `coffee/paper-deep ${where}`);
          assert.ok(contrast(vars.terracotta, vars.paper) >= 4.5, `terracotta/paper ${where}`);
        }
      }
    }
  });

  test("overcast skies mute the paper", () => {
    const clear = themeAt({ altitude: 1, morning: false }, CALM).vars.paper;
    const grey = themeAt({ altitude: 1, morning: false }, { ...CALM, cloud: 1 }).vars.paper;
    const spread = (hex) => Math.max(...hexToRgb(hex)) - Math.min(...hexToRgb(hex));
    assert.ok(spread(grey) < spread(clear));
  });

  test("golden hour differs from dawn", () => {
    const dawn = themeAt({ altitude: 0, morning: true }, CALM).vars;
    const dusk = themeAt({ altitude: 0, morning: false }, CALM).vars;
    assert.ok(paletteDistance(dawn, dusk) > 5);
  });
});

describe("skyAt", () => {
  test("hero text over the sky stays readable when the sky and theme agree", () => {
    for (const weather of skies) {
      for (const altitude of altitudes) {
        const clock = { altitude, morning: altitude > 0 };
        const { vars, scheme } = themeAt(clock, weather);
        const sky = skyAt(clock, weather, scheme === "dark" ? 1 : 0);
        const where = `alt ${altitude.toFixed(3)} cloud ${weather.cloud}`;
        for (const color of [sky.zenith, sky.horizon]) {
          assert.ok(contrast(vars.ink, color) >= 4.5, `ink over sky ${color} at ${where}`);
        }
      }
    }
  });

  test("stars only come out at night and hide behind clouds", () => {
    assert.equal(skyAt({ altitude: 0.8, morning: false }, CALM, 0).stars, 0);
    assert.ok(skyAt({ altitude: -1, morning: false }, CALM, 1).stars > 0.95);
    assert.ok(skyAt({ altitude: -1, morning: false }, { ...CALM, cloud: 1 }, 1).stars < 0.15);
  });

  test("horizon glow peaks at sunrise and sunset", () => {
    const glow = (altitude) => skyAt({ altitude, morning: false }, CALM, altitude < NIGHT_BELOW ? 1 : 0).glowAlpha;
    assert.ok(glow(0) > glow(0.2));
    assert.ok(glow(0) > glow(-0.2));
    assert.equal(glow(0.9), 0);
  });

  test("the sun warms toward the horizon", () => {
    assert.ok(skyAt({ altitude: 0.05, morning: true }, CALM, 0).sunWarmth > 0.9);
    assert.equal(skyAt({ altitude: 0.9, morning: true }, CALM, 0).sunWarmth, 0);
  });

  test("overcast veil grows with cloud cover", () => {
    const veil = (cloud) => skyAt({ altitude: 0.5, morning: false }, { ...CALM, cloud }, 0).veilAlpha;
    assert.equal(veil(0.2), 0);
    assert.ok(veil(1) > veil(0.7));
  });

  test("returns valid colours everywhere", () => {
    for (const altitude of altitudes) {
      for (const darkness of [0, 0.5, 1]) {
        const sky = skyAt({ altitude, morning: false }, skies[2], darkness);
        for (const key of ["zenith", "horizon", "veil", "glow", "cloudLight", "cloudShade", "rain", "snow", "fog"]) {
          assert.match(sky[key], /^#[0-9a-f]{6}$/, key);
        }
        for (const key of ["glowAlpha", "veilAlpha", "stars", "sunWarmth"]) {
          assert.ok(sky[key] >= 0 && sky[key] <= 1, `${key}=${sky[key]}`);
        }
      }
    }
  });
});
