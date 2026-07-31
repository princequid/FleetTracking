/**
 * Design tokens for the driver app — the theme-independent half of the system.
 *
 * Colours live in `constants/theme.js` because they flip between light and dark.
 * Everything here (spacing, radius, type, motion) is identical in both themes,
 * so it lives outside the theme object and is imported directly:
 *
 *     import { space, radius, type, motion } from '../constants/tokens';
 *
 * ── Why these numbers ────────────────────────────────────────────────────────
 * These aren't invented. They were derived from what the app already uses, so
 * migrating a screen is mostly a rename rather than a redesign. The audit
 * measured, across all 22 screens:
 *
 *     27 distinct borderRadius values   (1 … 50)
 *     16 distinct fontSize values       (9 … 34)
 *     27 distinct padding values        (incl. 7, 9, 11, 13, 110, 130)
 *     13 distinct gap values
 *
 * The scales below collapse those into 9 spacing steps, 5 radii and 9 type
 * roles, chosen to sit on or within 2px of the app's existing dominant values.
 */

// ── Spacing ──────────────────────────────────────────────────────────────────
// A 4pt grid. The app's four most-used padding values (20, 16, 14, 12) and
// most-used gaps (12, 10, 8) all land on or adjacent to a step here.
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};

/**
 * Semantic spacing. Prefer these over raw steps for the four cases the app
 * repeats on every screen — it's what stops one screen using 16 and the next
 * using 20 for the same job.
 */
export const layout = {
  /** Left/right gutter for screen content. The app's dominant value (39 uses). */
  screenX: space[5], // 20
  /** Padding inside a card or panel. */
  cardPadding: space[4], // 16
  /** Vertical gap between major sections of a screen. */
  sectionGap: space[6], // 24
  /** Gap between items in a list or row. */
  itemGap: space[3], // 12
  /**
   * Bottom padding for scroll views on driver screens. FloatingTabBar is
   * absolutely positioned 24pt from the bottom and 64pt tall, so content must
   * clear ~110pt or the last row sits under the bar.
   */
  tabBarClearance: 110,
};

// ── Radius ───────────────────────────────────────────────────────────────────
// Deliberately on the 4pt grid rather than preserving the app's single most-used
// value (14, 36 uses). A 2px radius shift is imperceptible, and matching the
// spacing grid makes the two systems reason about the same numbers.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Pills and circles. Large constant rather than % so it works on any size. */
  pill: 999,
};

// ── Typography ───────────────────────────────────────────────────────────────
// Inter, loaded in app/_layout.jsx as five named weights. Every role below is a
// complete text style — size AND line height AND weight — because the most
// common typography bug in this codebase is a size set without a line height,
// which leaves RN's default leading and makes stacked text look cramped.
export const font = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold',
};

export const type = {
  /** Splash wordmark, big standalone figures. Use at most once per screen. */
  display: { fontFamily: font.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  /** Screen title. */
  h1: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  /** Section heading, card title. */
  h2: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  /** Sub-heading, list-group header. */
  h3: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24 },
  /** Default body copy. */
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** Body copy that needs emphasis — a value against its label. */
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 22 },
  /** Secondary copy, metadata, table cells. The app's most-used size. */
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  /**
   * Micro-labels. The app sets these uppercase ("QUICK ACTIONS", "TODAY'S
   * TRIPS"), which needs positive tracking or the caps run together.
   */
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  /** Button labels. */
  button: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  /** Tab-bar labels. Matches FloatingTabBar's existing 10pt. */
  navLabel: { fontFamily: font.medium, fontSize: 10, lineHeight: 13 },
};

// ── Motion ───────────────────────────────────────────────────────────────────
// Same three durations as the admin portal's design system, so the two products
// feel like one company. Anything longer than `slow` makes the app feel sluggish
// rather than considered.
export const motion = {
  fast: 140,   // press feedback, colour/opacity changes
  base: 220,   // most transitions — sheets, expand/collapse, list entrances
  slow: 380,   // full-screen or attention-directing moves only
  /**
   * Reanimated spring presets. `press` is critical-ish so a button settles
   * without visible wobble; `entrance` is allowed a little overshoot.
   */
  spring: {
    press: { damping: 18, stiffness: 320, mass: 0.6 },
    entrance: { damping: 14, stiffness: 180, mass: 0.9 },
  },
  /** Per-item delay for staggered list entrances. Cap the count — see below. */
  stagger: 45,
  /**
   * Beyond ~8 items a stagger stops reading as one movement and starts looking
   * like a slow cascade. Animate the first N, render the rest immediately.
   */
  staggerMax: 8,
};

// ── Touch targets ────────────────────────────────────────────────────────────
/**
 * WCAG 2.5.8 (AA) floor is 24×24; Apple HIG and Material both say 44–48. The
 * app currently has 3 `hitSlop` uses in total, so icon-only controls are the
 * main offender. `iconButton` is the size an icon-only Pressable should be.
 */
export const touch = {
  /** Minimum any interactive element should measure. */
  min: 44,
  /** Square size for icon-only buttons. */
  iconButton: 44,
  /** Drop onto a small control that can't be grown for layout reasons. */
  slop: { top: 8, bottom: 8, left: 8, right: 8 },
};

export default { space, layout, radius, font, type, motion, touch };
