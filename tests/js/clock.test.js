import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  dayOfYear,
  daylightHours,
  isDaylightSaving,
  localHours,
  moonPhase,
  skyClock,
  sunSchedule,
} from "../../site/js/sky/clock.js";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("dayOfYear", () => {
  test("counts from 1 January", () => {
    assert.equal(dayOfYear(at(2026, 1, 1)), 1);
    assert.equal(dayOfYear(at(2026, 12, 31)), 365);
    assert.equal(dayOfYear(at(2024, 12, 31)), 366);
  });

  test("is stable across a DST jump", () => {
    process.env.TZ = "America/Edmonton";
    assert.equal(dayOfYear(at(2026, 3, 8, 23)) - dayOfYear(at(2026, 3, 7, 23)), 1);
  });
});

describe("daylightHours", () => {
  test("equinox is about twelve hours everywhere", () => {
    for (const lat of [-60, -30, 0, 30, 51, 60]) {
      assert.ok(Math.abs(daylightHours(lat, 80) - 12) < 0.35, `lat ${lat}`);
    }
  });

  test("Calgary solstices", () => {
    assert.ok(Math.abs(daylightHours(51, 172) - 16.3) < 0.4);
    assert.ok(Math.abs(daylightHours(51, 355) - 7.9) < 0.4);
  });

  test("southern hemisphere is mirrored", () => {
    assert.ok(Math.abs(daylightHours(-51, 172) - daylightHours(51, 355)) < 0.2);
  });

  test("polar day and night", () => {
    assert.equal(daylightHours(80, 172), 24);
    assert.equal(daylightHours(80, 355), 0);
    assert.equal(daylightHours(90, 172), 24);
  });
});

describe("isDaylightSaving", () => {
  test("follows the browser's time zone", () => {
    process.env.TZ = "America/Edmonton";
    assert.equal(isDaylightSaving(at(2026, 7, 1, 12)), true);
    assert.equal(isDaylightSaving(at(2026, 1, 15, 12)), false);
  });

  test("zones without DST", () => {
    process.env.TZ = "UTC";
    assert.equal(isDaylightSaving(at(2026, 7, 1, 12)), false);
    process.env.TZ = "Asia/Tokyo";
    assert.equal(isDaylightSaving(at(2026, 7, 1, 12)), false);
  });

  test("southern hemisphere summer", () => {
    process.env.TZ = "Australia/Sydney";
    assert.equal(isDaylightSaving(at(2026, 1, 15, 12)), true);
    assert.equal(isDaylightSaving(at(2026, 7, 15, 12)), false);
  });
});

describe("sunSchedule", () => {
  test("solar noon shifts to 13:00 under DST", () => {
    process.env.TZ = "America/Edmonton";
    assert.equal(sunSchedule(at(2026, 7, 1), 51).noon, 13);
    assert.equal(sunSchedule(at(2026, 1, 1), 51).noon, 12);
  });

  test("keeps an arc at the poles", () => {
    process.env.TZ = "UTC";
    const summer = sunSchedule(at(2026, 6, 21), 85);
    const winter = sunSchedule(at(2026, 12, 21), 85);
    assert.equal(summer.sunset - summer.sunrise, 19);
    assert.equal(winter.sunset - winter.sunrise, 5);
  });

  test("defaults the latitude", () => {
    process.env.TZ = "UTC";
    assert.deepEqual(sunSchedule(at(2026, 3, 21), undefined), sunSchedule(at(2026, 3, 21), 45));
    assert.deepEqual(sunSchedule(at(2026, 3, 21), NaN), sunSchedule(at(2026, 3, 21), 45));
  });
});

describe("skyClock", () => {
  test("noon, horizon and midnight", () => {
    process.env.TZ = "UTC";
    const noon = skyClock(at(2026, 3, 21, 12), 45);
    assert.ok(noon.altitude > 0.99);
    assert.ok(Math.abs(noon.day - 0.5) < 0.01);
    assert.equal(noon.isDay, true);

    const { sunrise } = sunSchedule(at(2026, 3, 21), 45);
    const dawn = new Date(at(2026, 3, 21).getTime() + sunrise * 3_600_000);
    assert.ok(Math.abs(skyClock(dawn, 45).altitude) < 0.01);

    const midnight = skyClock(at(2026, 3, 21, 0), 45);
    assert.ok(midnight.altitude < -0.99);
    assert.equal(midnight.isDay, false);
    assert.ok(Math.abs(midnight.night - 0.5) < 0.02);
  });

  test("altitude is continuous around the clock, including DST days", () => {
    for (const tz of ["UTC", "America/Edmonton", "Australia/Sydney", "Asia/Kolkata"]) {
      process.env.TZ = tz;
      for (const [y, m, d] of [
        [2026, 3, 8],
        [2026, 6, 21],
        [2026, 11, 1],
        [2026, 12, 21],
      ]) {
        let previous = skyClock(at(y, m, d), 51).altitude;
        for (let minute = 5; minute <= 24 * 60; minute += 5) {
          const current = skyClock(new Date(at(y, m, d).getTime() + minute * 60_000), 51).altitude;
          assert.ok(Math.abs(current - previous) < 0.06, `${tz} ${m}/${d} +${minute}m jumped ${previous}→${current}`);
          assert.ok(current >= -1 && current <= 1);
          previous = current;
        }
      }
    }
  });

  test("day progress sweeps 0→1 and night progress sweeps 0→1", () => {
    process.env.TZ = "UTC";
    const base = at(2026, 9, 27);
    const { sunrise, sunset } = sunSchedule(base, 51);
    const hour = (h) => skyClock(new Date(base.getTime() + h * 3_600_000), 51);
    assert.ok(Math.abs(hour(sunrise).day) < 1e-6);
    assert.ok(Math.abs(hour(sunset).day - 1) < 1e-6);
    assert.ok(Math.abs(hour(sunset).night) < 1e-6);
    assert.ok(Math.abs(hour(sunrise - 1e-6).night - 1) < 1e-3);
    assert.ok(hour(12).night < 0, "moon is below the horizon at noon");
  });

  test("moon progress is continuous from sunset through midnight to sunrise", () => {
    process.env.TZ = "UTC";
    const base = at(2026, 9, 27);
    const { sunrise, sunset } = sunSchedule(base, 51);
    let previous = skyClock(new Date(base.getTime() + sunset * 3_600_000), 51).night;
    for (let h = sunset + 0.05; h < sunrise + 24; h += 0.05) {
      const date = new Date(base.getTime() + h * 3_600_000);
      const { night } = skyClock(date, 51);
      assert.ok(night > previous && night - previous < 0.01, `h=${h.toFixed(2)} ${previous}→${night}`);
      previous = night;
    }
  });

  test("morning flag", () => {
    process.env.TZ = "UTC";
    assert.equal(skyClock(at(2026, 3, 21, 6), 45).morning, true);
    assert.equal(skyClock(at(2026, 3, 21, 18), 45).morning, false);
  });

  test("localHours has minute precision", () => {
    assert.equal(localHours(at(2026, 1, 1, 21, 30)), 21.5);
  });
});

describe("moonPhase", () => {
  test("known new and full moons", () => {
    const near = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) < 0.03;
    assert.ok(near(moonPhase(new Date(Date.UTC(2024, 0, 11, 11, 57))), 0));
    assert.ok(near(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))), 0.5));
    assert.ok(near(moonPhase(new Date(Date.UTC(2026, 8, 26, 16, 49))), 0.5));
  });

  test("always in [0, 1)", () => {
    for (let year = 1990; year <= 2060; year += 3) {
      const phase = moonPhase(new Date(Date.UTC(year, 5, 1)));
      assert.ok(phase >= 0 && phase < 1);
    }
  });
});
