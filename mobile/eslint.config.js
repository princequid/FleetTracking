const a11y = require("eslint-plugin-react-native-a11y");

/**
 * Accessibility lint for the driver app.
 *
 * This is deliberately NOT a general-purpose ESLint setup — no style rules, no
 * react rules, nothing about unused variables. It exists for one job: catch
 * touchables and images that a screen reader cannot describe. The audit found
 * exactly one `accessibilityLabel` and one `accessibilityRole` across 22 screens,
 * so this is the gate that stops that from being reintroduced as components land.
 *
 * `eslint-plugin-react-native-a11y` declares peer support for eslint ^3–^8 only,
 * so its bundled `configs` are eslintrc-format and cannot be spread into flat
 * config. The rules themselves use the stable rule API and run fine under 9, so
 * they're wired up explicitly below.
 *
 *     npx eslint .                 # whole app
 *     npx eslint app/(driver)      # one area
 */
module.exports = [
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "**/*.config.js",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-native-a11y": a11y },
    rules: {
      // ── The core gate ────────────────────────────────────────────────────
      // A touchable with no accessible name is invisible to a screen reader.
      // This one rule accounts for all 82 findings in the baseline run.
      //
      // `has-accessibility-props` is the older, narrower rule covering the same
      // ground; it matched 0 of those 82, so it's left off rather than kept as
      // config that implies coverage it doesn't add.
      "react-native-a11y/has-valid-accessibility-descriptors": "error",

      // Roles and states must be spelled correctly and be real values —
      // a typo'd role silently does nothing, which is worse than omitting it.
      "react-native-a11y/has-valid-accessibility-role": "error",
      "react-native-a11y/has-valid-accessibility-state": "error",
      "react-native-a11y/has-valid-accessibility-value": "error",
      "react-native-a11y/has-valid-accessibility-actions": "error",
      "react-native-a11y/has-valid-accessibility-live-region": "error",
      "react-native-a11y/has-valid-accessibility-descriptors": "error",

      // Nested touchables produce one target the reader can't disambiguate.
      // Real risk here: list rows that are pressable and contain pressable icons.
      "react-native-a11y/no-nested-touchables": "error",

      // Hints are genuinely optional — a good label usually makes them noise —
      // so this is a warning to look at, not a build break.
      "react-native-a11y/has-accessibility-hint": "warn",

      // Deliberately off:
      // - has-valid-accessibility-component-type / -traits / -states are the
      //   pre-0.57 RN APIs. This app is on RN 0.81; enabling them would demand
      //   deprecated props.
      // - has-valid-accessibility-ignores-invert-colors is iOS-only and applies
      //   to image views we don't yet render.
      // - has-valid-important-for-accessibility is Android-only and noisy on
      //   decorative wrappers.
    },
  },
];
