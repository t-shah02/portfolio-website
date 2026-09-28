import { clamp } from "./math.js";

export const CALM = Object.freeze({ cloud: 0, rain: 0, snow: 0, fog: 0, thunder: 0, wind: 0, lat: null });

const REFERENCE_AREA = 1920 * 1080;
const MAX_RAIN = 520;
const MAX_SNOW = 340;
const MAX_CLOUDS = 15;
const STARS = 170;

const unit = (value) => (Number.isFinite(value) ? clamp(value) : 0);

/** Trusts nothing from the page payload or the URL: every field ends up a finite number in range. */
export function normalizeWeather(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const lat = Number(source.lat);
  const wind = Number(source.wind);
  return {
    cloud: unit(Number(source.cloud)),
    rain: unit(Number(source.rain)),
    snow: unit(Number(source.snow)),
    fog: unit(Number(source.fog)),
    thunder: unit(Number(source.thunder)),
    wind: Number.isFinite(wind) ? clamp(wind, -1, 1) : 0,
    lat: source.lat !== null && Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
  };
}

export function areaScale(width, height) {
  return clamp((width * height) / REFERENCE_AREA, 0.4, 1.6);
}

/** How many of each thing to draw for this weather on this screen. */
export function particleBudget(weather, width, height) {
  const scale = areaScale(width, height);
  const widthScale = clamp(width / 1920, 0.6, 1.4);
  return {
    rain: Math.round(weather.rain * MAX_RAIN * scale),
    snow: Math.round(weather.snow * MAX_SNOW * scale),
    clouds: weather.cloud < 0.05 ? 0 : Math.max(1, Math.round(weather.cloud * MAX_CLOUDS * widthScale)),
    stars: Math.round(STARS * scale),
  };
}

/** Precipitation needs 60 fps to read as motion; drifting clouds and twinkling stars are fine at 30. */
export function frameInterval(weather) {
  return weather.rain > 0 || weather.snow > 0 || weather.thunder > 0 ? 1000 / 60 : 1000 / 30;
}
