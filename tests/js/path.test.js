import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  FOOTPRINT,
  arcPoint,
  bodyPosition,
  bodyRadius,
  gutterX,
  horizonFade,
  scrollRatio,
  tuckAmount,
  tuckedRadius,
} from "../../site/js/sky/path.js";

// The site's content column: min(72rem, 100% - 2.4rem), centred.
const column = (width) => {
  const inner = Math.min(1152, width - 38.4);
  return { left: (width - inner) / 2, right: (width + inner) / 2 };
};

const viewports = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
  [1024, 1366],
];

describe("arcPoint", () => {
  test("rises from the left horizon, peaks mid-sky, sets on the right", () => {
    const [w, h] = [1920, 1080];
    const rise = arcPoint(0, w, h);
    const noon = arcPoint(0.5, w, h);
    const set = arcPoint(1, w, h);
    assert.ok(rise.x < w * 0.1 && set.x > w * 0.9);
    assert.ok(Math.abs(noon.x - w / 2) < 1e-9);
    assert.ok(noon.y < rise.y && noon.y < set.y);
    assert.ok(Math.abs(rise.y - set.y) < 1e-9);
  });

  test("dips below the horizon past the ends", () => {
    assert.ok(arcPoint(-0.05, 1000, 1000).y > arcPoint(0, 1000, 1000).y);
    assert.ok(arcPoint(1.05, 1000, 1000).y > arcPoint(1, 1000, 1000).y);
  });

  test("clears the sticky header at its peak", () => {
    for (const [w, h] of viewports) assert.ok(arcPoint(0.5, w, h).y - bodyRadius(w, h) > 64);
  });
});

describe("bodyPosition follows the scrollbar", () => {
  const place = (progress, width, height, extra = {}) =>
    bodyPosition(progress, { width, height, content: column(width), r: bodyRadius(width, height), ...extra });

  test("stays fully on screen in every section of the page", () => {
    for (const [w, h] of viewports) {
      for (let progress = 0.08; progress <= 0.92; progress += 0.02) {
        for (let scroll = 0; scroll <= 1; scroll += 0.1) {
          for (const tuck of [0, 0.5, 1]) {
            const r = tuckedRadius(bodyRadius(w, h), column(w), w, tuck) * FOOTPRINT;
            const { x, y } = place(progress, w, h, { scroll, tuck, r: r / FOOTPRINT });
            const where = `${w}x${h} p=${progress.toFixed(2)} s=${scroll.toFixed(1)} tuck=${tuck}`;
            assert.ok(y - r >= 0 && y + r <= h, `${where} y=${y}`);
            assert.ok(x - r >= -1e-9 && x + r <= w + 1e-9, `${where} x=${x}`);
          }
        }
      }
    }
  });

  test("once tucked, the body sits beside the content column instead of behind it", () => {
    for (const [w, h] of [
      [1920, 1080],
      [2560, 1440],
      [3440, 1440],
    ]) {
      const content = column(w);
      const r = tuckedRadius(bodyRadius(w, h), content, w, 1);
      for (const progress of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
        const { x } = place(progress, w, h, { tuck: 1, r });
        const footprint = r * FOOTPRINT;
        assert.ok(x + footprint <= content.left + 1e-9 || x - footprint >= content.right - 1e-9, `${w}px p=${progress} x=${x}`);
      }
    }
  });

  test("morning bodies tuck left, afternoon bodies tuck right", () => {
    const w = 1920;
    assert.ok(place(0.2, w, 1080, { tuck: 1 }).x < column(w).left);
    assert.ok(place(0.8, w, 1080, { tuck: 1 }).x > column(w).right);
  });

  test("the tucked path is continuous through midday", () => {
    // 0.001 of a 12-hour day is ~43 seconds.
    let previous = place(0, 1920, 1080, { tuck: 1 }).x;
    for (let progress = 0.001; progress <= 1; progress += 0.001) {
      const { x } = place(progress, 1920, 1080, { tuck: 1 });
      assert.ok(Math.abs(x - previous) < 16, `jump at ${progress}`);
      previous = x;
    }
  });

  test("untucked or without a measured column, the body rides the arc", () => {
    assert.deepEqual(place(0.3, 1920, 1080), arcPoint(0.3, 1920, 1080));
    assert.deepEqual(bodyPosition(0.3, { width: 1920, height: 1080, tuck: 1 }), arcPoint(0.3, 1920, 1080));
  });

  test("sinks as the reader scrolls, never below the horizon", () => {
    const [w, h] = [1920, 1080];
    for (const progress of [0.02, 0.2, 0.5, 0.8]) {
      let previous = -Infinity;
      for (let scroll = 0; scroll <= 1; scroll += 0.25) {
        const { y } = place(progress, w, h, { scroll });
        assert.ok(y >= previous);
        assert.ok(y <= h * 0.97 + 1e-9);
        previous = y;
      }
    }
  });

  test("scroll only moves the body vertically", () => {
    assert.equal(place(0.3, 1920, 1080, { scroll: 0 }).x, place(0.3, 1920, 1080, { scroll: 1 }).x);
  });

  test("out-of-range scroll and tuck are clamped", () => {
    assert.deepEqual(place(0.3, 1920, 1080, { scroll: 5, tuck: 9 }), place(0.3, 1920, 1080, { scroll: 1, tuck: 1 }));
    assert.deepEqual(place(0.3, 1920, 1080, { scroll: -5 }), place(0.3, 1920, 1080, { scroll: 0 }));
  });
});

describe("tucking", () => {
  test("starts after the hero begins to scroll away and completes within a screen", () => {
    assert.equal(tuckAmount(0, 1000), 0);
    assert.equal(tuckAmount(100, 1000), 0);
    assert.ok(tuckAmount(400, 1000) > 0.3 && tuckAmount(400, 1000) < 0.7);
    assert.equal(tuckAmount(700, 1000), 1);
    assert.equal(tuckAmount(5000, 1000), 1);
    assert.equal(tuckAmount(100, 0), 0);
  });

  test("wide gutters keep the full size; narrow ones shrink it, but not below 55%", () => {
    assert.equal(tuckedRadius(48, column(2560), 2560, 1), 48);
    assert.equal(tuckedRadius(40, column(1440), 1440, 1), 40);
    const narrow = tuckedRadius(40, column(1366), 1366, 1);
    assert.ok(narrow < 40 && narrow >= 22, `${narrow}`);
    assert.equal(tuckedRadius(40, column(1280), 1280, 1), 22);
    assert.equal(tuckedRadius(40, column(1280), 1280, 0), 40);
  });

  test("gutter targets stay on screen even with no margin at all", () => {
    const content = { left: 0, right: 1000 };
    assert.equal(gutterX(0.1, 1000, content, 20), 20 * FOOTPRINT);
    assert.equal(gutterX(0.9, 1000, content, 20), 1000 - 20 * FOOTPRINT);
  });
});

describe("scrollRatio", () => {
  test("maps scroll position to 0..1", () => {
    assert.equal(scrollRatio(0, 3000, 1000), 0);
    assert.equal(scrollRatio(1000, 3000, 1000), 0.5);
    assert.equal(scrollRatio(2000, 3000, 1000), 1);
  });

  test("handles short pages and overscroll", () => {
    assert.equal(scrollRatio(0, 800, 1000), 0);
    assert.equal(scrollRatio(-50, 3000, 1000), 0);
    assert.equal(scrollRatio(2500, 3000, 1000), 1);
  });
});

describe("horizonFade", () => {
  test("hidden below, full above, symmetric", () => {
    assert.equal(horizonFade(-0.2), 0);
    assert.equal(horizonFade(1.2), 0);
    assert.equal(horizonFade(0.5), 1);
    assert.ok(Math.abs(horizonFade(0) - 0.5) < 1e-9);
    assert.ok(Math.abs(horizonFade(0.02) - horizonFade(0.98)) < 1e-9);
  });
});

describe("bodyRadius", () => {
  test("scales with the viewport within limits", () => {
    assert.equal(bodyRadius(400, 300), 30);
    assert.equal(bodyRadius(5000, 3000), 64);
    assert.ok(bodyRadius(1920, 1080) > bodyRadius(1280, 720));
  });
});
