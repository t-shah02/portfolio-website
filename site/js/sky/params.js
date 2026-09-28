import { clamp } from "./math.js";

const CLEAR = { cloud: 0, rain: 0, snow: 0, fog: 0, thunder: 0, wind: 0 };

export const PRESETS = {
  clear: CLEAR,
  cloudy: { ...CLEAR, cloud: 0.5 },
  overcast: { ...CLEAR, cloud: 0.95 },
  drizzle: { ...CLEAR, cloud: 0.75, rain: 0.2 },
  rain: { ...CLEAR, cloud: 0.85, rain: 0.6, wind: 0.2 },
  storm: { ...CLEAR, cloud: 1, rain: 1, thunder: 1, wind: 0.5 },
  snow: { ...CLEAR, cloud: 0.85, snow: 0.55, wind: -0.1 },
  blizzard: { ...CLEAR, cloud: 1, snow: 1, wind: 0.8 },
  fog: { ...CLEAR, cloud: 0.7, fog: 0.8 },
};

const WEATHER_KEYS = new Set(["cloud", "rain", "snow", "fog", "thunder", "wind"]);
const MAX_SPEED = 100_000;

/** "21:30", "7:05" or "21.5" → hours since midnight. */
export function parseTime(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(value) ?? /^(\d{1,2}(?:\.\d+)?)$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]) + (match[2] ? Number(match[2]) / 60 : 0);
  if (match[2] && Number(match[2]) >= 60) return undefined;
  return hours >= 0 && hours < 24 ? hours : undefined;
}

/** `sky-weather=storm` or `sky-weather=rain,cloud:0.3` or `sky-weather=snow:1,wind:-0.5`. */
export function parseWeather(value) {
  const weather = {};
  for (const part of value.split(",")) {
    const [key, raw] = part.split(":").map((s) => s.trim());
    if (raw === undefined && key in PRESETS) {
      Object.assign(weather, PRESETS[key]);
      continue;
    }
    const number = Number(raw);
    if (!WEATHER_KEYS.has(key) || raw === "" || !Number.isFinite(number)) continue;
    weather[key] = key === "wind" ? clamp(number, -1, 1) : clamp(number);
  }
  return weather;
}

function numberParam(params, name) {
  const raw = params.get(name)?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Preview overrides from the URL, for testing and showing off:
 * `?sky-time=21:30&sky-speed=600&sky-weather=storm&sky-lat=64`.
 */
export function parseSkyParams(search) {
  const params = new URLSearchParams(search);
  const out = { weather: {} };
  const time = params.get("sky-time");
  if (time !== null) {
    const hours = parseTime(time.trim());
    if (hours !== undefined) out.time = hours;
  }
  const speed = numberParam(params, "sky-speed");
  if (speed !== undefined && speed > 0) out.speed = Math.min(speed, MAX_SPEED);
  const lat = numberParam(params, "sky-lat");
  if (lat !== undefined && Math.abs(lat) <= 90) out.lat = lat;
  const weather = params.get("sky-weather");
  if (weather) out.weather = parseWeather(weather);
  return out;
}

/** A `() => Date` that honours the time and speed overrides. */
export function makeClock({ time, speed = 1 } = {}, now = Date.now) {
  const startedAt = now();
  let origin = startedAt;
  if (time !== undefined) {
    const start = new Date(startedAt);
    start.setHours(0, 0, 0, 0);
    origin = start.getTime() + time * 3_600_000;
  }
  if (origin === startedAt && speed === 1) return () => new Date(now());
  return () => new Date(origin + (now() - startedAt) * speed);
}
