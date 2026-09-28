// A strict stand-in for CanvasRenderingContext2D. Real canvases silently ignore
// NaN coordinates, bad colours and out-of-range gradient stops; this one throws.

const COLOR = /^(#[0-9a-f]{6}|rgba?\(\d{1,3},\d{1,3},\d{1,3}(,(0|1|0?\.\d+))?\))$/i;

function assertFinite(name, args) {
  for (const arg of args) {
    if (typeof arg === "number" && !Number.isFinite(arg)) {
      throw new Error(`${name} received ${arg}`);
    }
  }
}

function assertColor(where, value) {
  if (typeof value === "string" && !COLOR.test(value)) {
    throw new Error(`${where} got an invalid colour: ${value}`);
  }
}

export function fakeContext(canvas = null) {
  const calls = [];
  const state = { canvas, calls };
  const gradient = (name) => ({
    kind: name,
    addColorStop(offset, color) {
      if (!(offset >= 0 && offset <= 1)) throw new Error(`addColorStop offset ${offset}`);
      assertColor("addColorStop", color);
    },
  });
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return (...args) => {
          assertFinite(prop, args);
          calls.push(prop);
          return gradient(prop);
        };
      }
      return (...args) => {
        assertFinite(String(prop), args);
        if (prop === "arc" || prop === "ellipse") {
          const radii = prop === "arc" ? [args[2]] : [args[2], args[3]];
          if (radii.some((r) => r < 0)) throw new Error(`${prop} with negative radius`);
        }
        calls.push(String(prop));
      };
    },
    set(target, prop, value) {
      if (typeof value === "number") {
        assertFinite(String(prop), [value]);
        if (prop === "globalAlpha" && (value < 0 || value > 1)) throw new Error(`globalAlpha ${value}`);
      }
      if (prop === "fillStyle" || prop === "strokeStyle") assertColor(String(prop), value);
      target[prop] = value;
      return true;
    },
  });
}

export function fakeCanvas(width = 0, height = 0) {
  const canvas = { width, height, className: "", classList: new Set(), style: {} };
  canvas.getContext = () => {
    canvas.context ??= fakeContext(canvas);
    return canvas.context;
  };
  return canvas;
}

export function count(calls, name) {
  return calls.filter((call) => call === name).length;
}
