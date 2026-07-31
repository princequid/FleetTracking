/**
 * Semantic haptic feedback.
 *
 * The app currently makes 29 raw `Haptics.*` calls across 10 files, each screen
 * deciding for itself whether an action is Light, Medium or Success. The result
 * is that the same class of action buzzes differently depending on where you are.
 *
 * Call these by INTENT, never `expo-haptics` directly:
 *
 *     import { haptics } from '../lib/haptics';
 *     haptics.buttonPress();
 *     haptics.success();
 *
 * Adding a new intent here is fine. Reaching past this module to pick a raw
 * impact style in a screen is what this exists to prevent.
 *
 * ── Restraint ────────────────────────────────────────────────────────────────
 * Haptics are the easiest thing in a mobile app to overdo, and an app that
 * buzzes constantly gets its haptics switched off at the OS level — losing the
 * feedback on the actions that actually mattered. The rules:
 *
 *   - Never on scroll, never per animation frame, never on render.
 *   - Never on a purely navigational tap that already has a visual result.
 *   - `success`/`error` are for outcomes the driver waited on (photo uploaded,
 *     trip completed, submission rejected) — not for every state change.
 *   - One haptic per user action. If a press triggers both a selection and a
 *     success, fire only the success.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Web has no haptics API and expo-haptics no-ops there, but calling it still
 * costs a promise per press. Gate at the module level instead.
 */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

let enabled = true;

/**
 * Global off switch. Wire this to a Settings toggle if drivers ask for one —
 * some run the app mounted in a cab all day and don't want the buzz.
 */
export function setHapticsEnabled(next) {
  enabled = Boolean(next);
}

export function areHapticsEnabled() {
  return enabled && SUPPORTED;
}

/**
 * Every call is fire-and-forget and swallows its own failure. A haptic is
 * decoration: a device without a taptic engine, or one where the user revoked
 * vibration, must never turn a button press into an unhandled rejection.
 */
function fire(run) {
  if (!enabled || !SUPPORTED) return;
  try {
    const result = run();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    /* no haptic hardware, or permission withheld — not an error worth surfacing */
  }
}

export const haptics = {
  // ── Light: frequent, low-stakes ───────────────────────────────────────────
  /** Moving between tabs, segmented controls, pickers, list selection. */
  selection: () => fire(() => Haptics.selectionAsync()),

  /** A standard button press. The most common call in the app. */
  buttonPress: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Switch, checkbox, radio — anything that flips between two states. */
  toggle: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  // ── Medium: consequential ─────────────────────────────────────────────────
  /**
   * An action with real consequence: starting a trip, marking arrived,
   * submitting a report. Distinct from `buttonPress` so the driver can feel the
   * difference between "opened a screen" and "changed the trip".
   */
  action: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** A sheet or modal reaching its open/closed detent. */
  impact: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Long-press recognised — confirms the gesture registered before the menu appears. */
  longPress: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  // ── Notification: outcomes ────────────────────────────────────────────────
  /** An operation the driver waited on completed. Photo uploaded, trip delivered. */
  success: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Something needs attention but isn't a failure — queued offline, weak GPS. */
  warning: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** A real failure: submission rejected, upload failed, validation blocked. */
  error: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export default haptics;
