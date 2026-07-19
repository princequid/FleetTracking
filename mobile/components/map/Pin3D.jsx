import React from 'react';
import Svg, {
  Defs, LinearGradient, Stop, Path, Circle, Ellipse,
} from 'react-native-svg';

// Lighten/darken a hex color in RGB space, so every marker in the family gets a
// consistent glossy top-light/bottom-shade gradient from a single base color —
// one shape + shading recipe, recolored per role, instead of one-off gradients.
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

// Outer teardrop silhouette (bulb centered at 12,11 r=9, tapering to a point at 12,28).
const OUTER_PATH = 'M12 1C6.48 1 2 5.48 2 11c0 7.25 10 17 10 17s10-9.75 10-17c0-5.52-4.48-10-10-10z';
// Same silhouette with a second, opposite-wound circle subpath (center 12,11 r=3.5)
// that a default nonzero fill rule renders as a true cut-out hole.
const HOLE_PATH = `${OUTER_PATH}m0 13.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z`;

/**
 * Shared glossy 3D map pin — the base shape for the whole FleetTrack marker family
 * (driver, start, stops, destination). Every marker uses this exact silhouette,
 * gradient, and gloss highlight; only color, size, and hole/badge treatment vary,
 * so the set reads as one cohesive system rather than mismatched one-off icons.
 *
 * - `hole` (default true): a true see-through circular hole, like a standard pin.
 * - `hole={false}`: a solid white circular badge in its place, for `<PinNumber>`
 *   to lay a number on top of (SVG text / icon-font glyphs don't reliably
 *   rasterise inside a react-native-maps custom marker on Android, so numbers
 *   are drawn as an RN <Text> layered above this, not inside the SVG itself).
 * - `glow`: a soft halo behind the bulb, reserved for the driver's live marker
 *   so it stays the most prominent indicator on the map.
 */
export default function Pin3D({ color, size = 40, glow = false, hole = true }) {
  const light = shade(color, 30);
  const dark = shade(color, -25);
  const gradId = `pin-grad-${color.slice(1)}`;
  const height = size * (29 / 24);

  return (
    <Svg width={size} height={height} viewBox="0 0 24 29">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="1" stopColor={dark} />
        </LinearGradient>
      </Defs>

      {glow && (
        <>
          <Circle cx="12" cy="11" r="13.5" fill={color} opacity="0.14" />
          <Circle cx="12" cy="11" r="11"   fill={color} opacity="0.18" />
        </>
      )}

      {/* ground shadow beneath the pin's point */}
      <Ellipse cx="12" cy="27.5" rx="4" ry="1.3" fill="#000" opacity="0.22" />

      {/* body — white stroke keeps it legible against both light and dark map tiles */}
      <Path d={hole ? HOLE_PATH : OUTER_PATH} fill={`url(#${gradId})`} stroke="#fff" strokeWidth="0.7" />

      {!hole && <Circle cx="12" cy="11" r="4.3" fill="#fff" />}

      {/* glossy highlight along the upper-left curve */}
      <Ellipse cx="7.5" cy="7" rx="2.6" ry="4" fill="#fff" opacity="0.38" />
    </Svg>
  );
}

// Pixel offset of the badge center for a given rendered `size`, so callers can
// overlay an RN <Text> precisely on the solid-badge (`hole={false}`) variant.
Pin3D.badgeCenter = (size) => ({ x: size * 0.5, y: size * (11 / 24) });
