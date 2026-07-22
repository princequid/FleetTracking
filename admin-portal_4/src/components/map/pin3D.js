import L from "leaflet";

/**
 * Shared glossy 3D map pin for the admin portal — the same shape, gradient recipe,
 * and gloss highlight as the mobile app's components/map/Pin3D.jsx, so both apps
 * read as one visual system. Colors are passed in per-caller rather than fixed here:
 * the single-trip route map (TripRouteMap) uses the fixed brand colors (start green,
 * stop amber, destination red), while the multi-driver fleet map (LiveMapPage) needs
 * each active driver in their own distinct color, so it passes a per-driver hue there.
 */

// Lighten/darken a hex color in RGB space for a consistent top-light/bottom-shade
// gradient from a single base color.
export function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

// Outer teardrop silhouette (bulb centered at 12,11 r=9, tapering to a point at 12,28).
const OUTER_PATH = "M12 1C6.48 1 2 5.48 2 11c0 7.25 10 17 10 17s10-9.75 10-17c0-5.52-4.48-10-10-10z";
// Same silhouette with a second, opposite-wound circle subpath (center 12,11 r=3.5)
// that a default nonzero fill rule renders as a true cut-out hole.
const HOLE_PATH = `${OUTER_PATH}m0 13.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z`;

let gradientUid = 0;

/**
 * @param {string} color base hex color for this pin
 * @param {{size?: number, glow?: boolean, hole?: boolean, number?: number|string|null, opacity?: number}} opts
 *   - hole (default true): true see-through circular hole, like a standard pin.
 *   - hole=false: solid white circular badge instead, with `number` drawn on top —
 *     used for numbered stop pins.
 *   - glow: soft halo behind the bulb, for a marker that should stay the most
 *     prominent thing on the map (the live driver marker).
 */
export function pin3DSvg(color, { size = 40, glow = false, hole = true, number = null } = {}) {
  const light = shade(color, 30);
  const dark = shade(color, -25);
  const gradId = `pin3d-grad-${gradientUid++}`;
  const height = size * (29 / 24);

  const glowMarkup = glow
    ? `<circle cx="12" cy="11" r="13.5" fill="${color}" opacity="0.14"/>` +
      `<circle cx="12" cy="11" r="11" fill="${color}" opacity="0.18"/>`
    : "";
  const badge = !hole ? `<circle cx="12" cy="11" r="4.3" fill="#fff"/>` : "";
  const numberText = number != null
    ? `<text x="12" y="14.2" text-anchor="middle" font-size="6" font-weight="700" font-family="Inter, Arial, sans-serif" fill="#1E293B">${number}</text>`
    : "";

  return `
    <svg width="${size}" height="${height}" viewBox="0 0 24 29" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
      </defs>
      ${glowMarkup}
      <ellipse cx="12" cy="27.5" rx="4" ry="1.3" fill="#000" opacity="0.22"/>
      <path d="${hole ? HOLE_PATH : OUTER_PATH}" fill="url(#${gradId})" stroke="#fff" stroke-width="0.7"/>
      ${badge}${numberText}
      <ellipse cx="7.5" cy="7" rx="2.6" ry="4" fill="#fff" opacity="0.38"/>
    </svg>
  `;
}

/** Builds a Leaflet divIcon anchored at the pin's point, so the tip marks the exact coordinate. */
export function createPin3DIcon(color, opts = {}) {
  const size = opts.size ?? 40;
  const height = size * (29 / 24);
  const svg = pin3DSvg(color, opts);
  const html = opts.opacity != null ? `<div style="opacity:${opts.opacity};">${svg}</div>` : svg;
  return L.divIcon({
    className: `fleet-marker fleet-pin3d-marker${opts.extraClassName ? ` ${opts.extraClassName}` : ""}`,
    html,
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height],
  });
}
