import { clamp, lerp, smoothstep } from "./math.js";

const HORIZON = 0.97;
const PEAK = 0.17;
const SIDE_MARGIN = 0.07;
// How far (as a share of the viewport) the bodies sink by the bottom of the page.
const SCROLL_SINK = 0.12;
// Body footprint in radii: the latte's saucer is the widest part.
export const FOOTPRINT = 1.35;

/** A point on the celestial arc. Progress 0 and 1 sit on the horizon; beyond that the body dips under it. */
export function arcPoint(progress, width, height) {
  const left = width * SIDE_MARGIN;
  const horizon = height * HORIZON;
  return {
    x: left + (width - 2 * left) * progress,
    y: horizon - (horizon - height * PEAK) * Math.sin(Math.PI * progress),
  };
}

export function scrollRatio(scrollY, scrollHeight, viewportHeight) {
  const max = scrollHeight - viewportHeight;
  return max > 0 ? clamp(scrollY / max) : 0;
}

/** 0 while the hero is in view, 1 once the reader is into the content sections. */
export function tuckAmount(scrollY, viewportHeight) {
  return viewportHeight > 0 ? smoothstep(0.1, 0.7, scrollY / viewportHeight) : 0;
}

/**
 * Horizontal position in the empty margins beside the content column: the left
 * margin before noon, the right one after, crossing over the top around midday.
 */
export function gutterX(progress, width, content, r) {
  const edge = r * FOOTPRINT;
  const left = Math.max(edge, content.left / 2);
  const right = Math.min(width - edge, (content.right + width) / 2);
  return lerp(left, right, smoothstep(0.42, 0.58, progress));
}

/** Shrinks a body so it fits the side margin once tucked, never below 55% of its size. */
export function tuckedRadius(r, content, width, tuck) {
  const gutter = Math.min(content.left, width - content.right);
  const fit = clamp(gutter / (2 * FOOTPRINT + 0.3), r * 0.55, r);
  return lerp(r, fit, tuck);
}

/**
 * Where a body sits for this time and scroll position. At the top of the page it
 * rides the full arc; as the reader scrolls into the sections it glides into the
 * side margins so the content never hides it, and sinks a little with the scrollbar
 * (never further than halfway to the horizon).
 */
export function bodyPosition(progress, { width, height, scroll = 0, tuck = 0, content = null, r = 0 }) {
  const point = arcPoint(progress, width, height);
  if (content && tuck > 0) point.x = lerp(point.x, gutterX(progress, width, content, r), clamp(tuck));
  const room = Math.max(0, height * HORIZON - point.y);
  point.y += Math.min(height * SCROLL_SINK, room * 0.5) * clamp(scroll);
  return point;
}

export function bodyRadius(width, height) {
  return clamp(Math.min(width, height) * 0.045, 30, 64);
}

/** Fades a body in as it clears the horizon and out as it sets. */
export function horizonFade(progress, fade = 0.06) {
  return smoothstep(-fade, fade, progress) * smoothstep(1 + fade, 1 - fade, progress);
}
