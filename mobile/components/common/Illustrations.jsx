import React from 'react';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

/**
 * The app's illustration set.
 *
 * One visual language, drawn rather than sourced. Every piece here follows the
 * same three rules so a driver never sees two illustrations that look like they
 * came from different products:
 *
 *   1. **Two tones only** — a muted structural tone (`C.border`) for the
 *      scaffolding and one accent for the single element that carries meaning.
 *      No gradients, no shading, no third colour.
 *   2. **Uniform 1.8 stroke, round caps and joins** — matching Feather, which
 *      is already the app's only icon family. They sit together because they
 *      share a stroke language.
 *   3. **Outline, never filled** — filled shapes read as a different family
 *      next to Feather's outlines.
 *
 * ── Why SVG components rather than image assets ──────────────────────────────
 * They take their colours from the active theme, so they flip with dark mode
 * instead of needing a second set of files. They also cost about 1 KB each
 * rather than a few hundred, and stay crisp at any size — the app's four PNG
 * assets are 223 KB apiece and are all the same picture.
 *
 * Drop into any EmptyState or ErrorState via the `illustration` prop:
 *
 *     <EmptyState
 *       illustration={<NoTripsIllustration />}
 *       title="No trips today"
 *     />
 */

const SIZE = 120;
const STROKE = 1.8;

/** Shared frame so every illustration occupies exactly the same footprint. */
function Frame({ size = SIZE, children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {children}
    </Svg>
  );
}

/** Common stroke props — declared once so the family can't drift. */
const line = (color) => ({
  stroke: color,
  strokeWidth: STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
});

/** No trips assigned — an empty flatbed. */
export function NoTripsIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.teal;
  return (
    <Frame size={size}>
      <Rect x="14" y="46" width="52" height="30" rx="4" {...line(muted)} />
      <Path d="M66 56h16l10 12v8H66z" {...line(muted)} />
      <Circle cx="34" cy="84" r="8" {...line(tint)} />
      <Circle cx="80" cy="84" r="8" {...line(tint)} />
      <Line x1="14" y1="76" x2="26" y2="76" {...line(muted)} />
      <Line x1="42" y1="76" x2="72" y2="76" {...line(muted)} />
      {/* The empty bed — the whole point of the drawing. */}
      <Line x1="26" y1="58" x2="54" y2="58" {...line(muted)} strokeDasharray="4 5" />
    </Frame>
  );
}

/** No notifications — a bell at rest. */
export function NoAlertsIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.teal;
  return (
    <Frame size={size}>
      <Path
        d="M60 30c-11 0-19 8-19 19v14l-7 9h52l-7-9V49c0-11-8-19-19-19z"
        {...line(muted)}
      />
      <Path d="M53 80a7 7 0 0014 0" {...line(muted)} />
      <Line x1="60" y1="24" x2="60" y2="30" {...line(muted)} />
      {/* Quiet, not broken: a soft tick rather than a slash. */}
      <Path d="M74 40l5 5 9-10" {...line(tint)} />
    </Frame>
  );
}

/** Offline — a cloud with a broken link. */
export function OfflineIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.amber;
  return (
    <Frame size={size}>
      <Path
        d="M38 72a14 14 0 013-27 19 19 0 0136-4 15 15 0 013 30z"
        {...line(muted)}
      />
      <Line x1="46" y1="86" x2="54" y2="94" {...line(tint)} />
      <Line x1="66" y1="86" x2="74" y2="94" {...line(tint)} />
      <Line x1="60" y1="84" x2="60" y2="96" {...line(tint)} strokeDasharray="3 5" />
    </Frame>
  );
}

/** Something failed — a document with a warning mark. */
export function ErrorIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.red;
  return (
    <Frame size={size}>
      <Path d="M38 26h30l14 14v54H38z" {...line(muted)} />
      <Path d="M68 26v14h14" {...line(muted)} />
      <Line x1="60" y1="52" x2="60" y2="68" {...line(tint)} />
      <Circle cx="60" cy="78" r="1.6" fill={tint} />
    </Frame>
  );
}

/** No photos captured yet. */
export function NoPhotosIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.teal;
  return (
    <Frame size={size}>
      <Rect x="26" y="38" width="68" height="48" rx="6" {...line(muted)} />
      <Path d="M42 38l6-8h20l6 8" {...line(muted)} />
      <Circle cx="60" cy="62" r="13" {...line(tint)} />
      <Circle cx="82" cy="48" r="1.8" fill={muted} />
    </Frame>
  );
}

/** Location unavailable — a pin with no fix. */
export function NoLocationIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.amber;
  return (
    <Frame size={size}>
      <Path d="M60 28c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-9-20-20-20z" {...line(muted)} />
      <Circle cx="60" cy="48" r="7" {...line(tint)} strokeDasharray="3 4" />
      <Line x1="30" y1="94" x2="90" y2="94" {...line(muted)} strokeDasharray="4 6" />
    </Frame>
  );
}

/** Search returned nothing. */
export function NoResultsIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.teal;
  return (
    <Frame size={size}>
      <Circle cx="54" cy="52" r="22" {...line(muted)} />
      <Line x1="70" y1="68" x2="88" y2="86" {...line(muted)} />
      <Line x1="46" y1="52" x2="62" y2="52" {...line(tint)} />
    </Frame>
  );
}

/** All done — the success state. */
export function AllDoneIllustration({ size, accent }) {
  const C = useTheme();
  const muted = C.border;
  const tint = accent || C.green;
  return (
    <Frame size={size}>
      <Circle cx="60" cy="60" r="30" {...line(muted)} />
      <Path d="M46 60l10 10 20-22" {...line(tint)} />
      <G opacity={0.6}>
        <Line x1="94" y1="34" x2="99" y2="29" {...line(muted)} />
        <Line x1="22" y1="86" x2="27" y2="81" {...line(muted)} />
      </G>
    </Frame>
  );
}

export default {
  NoTrips: NoTripsIllustration,
  NoAlerts: NoAlertsIllustration,
  Offline: OfflineIllustration,
  Error: ErrorIllustration,
  NoPhotos: NoPhotosIllustration,
  NoLocation: NoLocationIllustration,
  NoResults: NoResultsIllustration,
  AllDone: AllDoneIllustration,
};
