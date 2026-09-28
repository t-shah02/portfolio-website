import { clamp } from "./math.js";

const DAY_MS = 86_400_000;
const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const RAD = Math.PI / 180;

export const DEFAULT_LATITUDE = 45;
// Keep a visible arc even under the midnight sun or polar night.
const MIN_DAYLIGHT_H = 5;
const MAX_DAYLIGHT_H = 19;

export function dayOfYear(date) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today - Date.UTC(date.getFullYear(), 0, 0)) / DAY_MS);
}

export function localHours(date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3_600_000;
}

export function isDaylightSaving(date) {
  const year = date.getFullYear();
  const standard = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
  return date.getTimezoneOffset() < standard;
}

/** Hours of daylight from the solar declination for a latitude and day of the year. */
export function daylightHours(latitude, day) {
  const declination = 23.44 * RAD * Math.sin((2 * Math.PI * (284 + day)) / 365);
  const x = -Math.tan(clamp(latitude, -89.9, 89.9) * RAD) * Math.tan(declination);
  if (x >= 1) return 0;
  if (x <= -1) return 24;
  return (2 * Math.acos(x)) / RAD / 15;
}

/** Sunrise and sunset in local clock hours. Solar noon moves to 13:00 under daylight saving. */
export function sunSchedule(date, latitude) {
  const noon = isDaylightSaving(date) ? 13 : 12;
  const lat = Number.isFinite(latitude) ? latitude : DEFAULT_LATITUDE;
  const length = clamp(daylightHours(lat, dayOfYear(date)), MIN_DAYLIGHT_H, MAX_DAYLIGHT_H);
  return { sunrise: noon - length / 2, sunset: noon + length / 2, noon };
}

/**
 * Where we are in the day for this browser's local time.
 * `day` runs 0→1 from sunrise to sunset, `night` 0→1 from sunset to the next sunrise,
 * and `altitude` is a smooth -1 (midnight) … 0 (horizon) … 1 (noon) curve.
 */
export function skyClock(date, latitude) {
  const { sunrise, sunset, noon } = sunSchedule(date, latitude);
  const hour = localHours(date);
  const dayLength = sunset - sunrise;
  const day = (hour - sunrise) / dayLength;
  // Negative through the day, so the moon rises continuously as the sun sets.
  const night = (hour < sunrise ? hour + 24 - sunset : hour - sunset) / (24 - dayLength);
  const isDay = day >= 0 && day <= 1;
  const altitude = isDay ? Math.sin(Math.PI * day) : -Math.sin(Math.PI * clamp(night, 0, 1));
  return { hour, sunrise, sunset, noon, day, night, altitude, isDay, morning: hour < noon };
}

/** 0 = new moon, 0.5 = full moon. */
export function moonPhase(date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / DAY_MS;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}
