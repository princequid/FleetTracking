import { createPin3DIcon } from "./pin3D";

// Standard HSL→hex conversion (h in degrees, s/l in 0-100). `base` needs to come out
// as hex (not an hsl() string) because pin3D's own shade() helper — which builds the
// pin's light/dark gradient — parses its input color as hex.
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Distinct, stable colour per driver — derived from the driver's account id via a
 * golden-angle hue spread (137.508°). Consecutive ids get well-separated hues, so any
 * number of drivers stay visually distinguishable, and a given account always maps to
 * the same colour everywhere (map marker + list) with no storage or backend involvement.
 */
export function driverColor(id) {
  const n = Number(id);
  const hue = Number.isFinite(n) ? (n * 137.508) % 360 : 210;
  return {
    base:  hslToHex(hue, 62, 47),
    light: hslToHex(hue, 62, 60),
    dark:  hslToHex(hue, 58, 32),
  };
}

/**
 * Live driver marker — the glossy 3D pin (components/map/pin3D.js), the same shape
 * family used for every marker on the mobile driver map, so both apps read as one
 * product. Unlike the mobile trip screen (a single driver, so the driver marker can
 * be one fixed brand blue), this is a fleet-wide view with many drivers active at
 * once, so it keeps each driver's own hue-derived colour rather than a single fixed
 * colour — that's what lets the admin tell drivers apart at a glance here.
 */
export function createDriverCarIcon(id, stale = false) {
  const c = driverColor(id);
  return createPin3DIcon(c.base, {
    size: 46,
    glow: true,
    opacity: stale ? 0.5 : 1,
    extraClassName: "fleet-car-marker",
  });
}

/**
 * Small pin marking a stop (numbered) or the destination along a driver's route,
 * tinted with that same driver's colour so it reads as part of their route.
 */
export function createRoutePinIcon(colorBase, label = "", isDest = false) {
  return createPin3DIcon(colorBase, {
    size: 32,
    hole: isDest,
    number: isDest ? null : label,
    extraClassName: "fleet-route-pin",
  });
}
