// Theme palettes for the driver app.
//
// `lightTheme` is the EXACT existing palette (imported from colors.js), so light mode
// is byte-for-byte unchanged. `darkTheme` mirrors the same keys with dark values, so a
// component that reads its colors from the active theme flips automatically.
//
// Both objects share the SAME KEYS as the legacy `C` constant, which makes migration a
// drop-in: swap `import { C } from '../constants/colors'` for `const C = useTheme()`.

import { C } from './colors';

export const lightTheme = C;

export const darkTheme = {
  // navyDark stays deep for headers/hero bars. navyPrimary/navyMid brighten into a
  // readable brand blue so they work BOTH as button/avatar fills (white text on them)
  // and as small foreground icons sitting on dark chips.
  navyDark:    '#0F2347',
  navyPrimary: '#3E6FD1',
  navyMid:     '#4C7BD9',

  // Accent teal brightened so it pops on dark surfaces.
  teal:        '#2DD4BF',
  tealLight:   '#5EEAD4',
  tealPale:    'rgba(45,212,191,0.15)', // was a pale fill → dark-tinted fill

  // Status colors: keep the hue but lighten, and swap the pale *Light fills for
  // dark-tinted versions so chips/badges don't glow white in dark mode.
  green:       '#34D399',
  greenLight:  'rgba(52,211,153,0.16)',
  amber:       '#FBBF24',
  amberLight:  'rgba(251,191,36,0.16)',
  red:         '#F87171',
  redLight:    'rgba(248,113,113,0.16)',

  // Text: light on dark.
  text1:       '#F1F5F9',
  text2:       '#CBD5E1',
  text3:       '#94A3B8',

  // Surfaces: page < elevated card, with a subtle border.
  bg:          '#0B1120',
  surface:     '#182236',
  border:      '#273449',
  accentSoft:  'rgba(62,111,209,0.18)', // icon-chip tint that carries the brand blue
};

export default { lightTheme, darkTheme };
