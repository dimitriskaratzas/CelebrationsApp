/**
 * Celebrations — Design Token System
 * Generated from design prototype (Aegean Noon + Sunset Blur themes).
 *
 * Usage:
 *   import { theme } from '@/ui/theme';
 *   style={{ color: theme.ink, borderRadius: theme.radius.card }}
 *
 * Drop this file in mobile/src/ui/theme.ts
 * Both themes are exported; active theme is chosen at runtime via ThemeContext.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared design tokens (same across both themes)
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  /** Display / headings — numbers, dates, section titles */
  display: {
    fontFamily: 'PlusJakartaSans_700Bold',
    // Large hero number (today count)
    hero:      { fontSize: 80, lineHeight: 72, letterSpacing: -1.5 },
    // Screen title (e.g. "16 Μαΐου")
    title:     { fontSize: 34, lineHeight: 36, letterSpacing: -0.5 },
    // Section heading (e.g. "Επόμενες")
    section:   { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
    // Date chip number
    dateChip:  { fontSize: 22, lineHeight: 24, letterSpacing: -0.3 },
  },
  /** Body / UI copy */
  body: {
    fontFamily: 'Manrope_600SemiBold',
    // Primary list item name
    primary:   { fontFamily: 'Manrope_700Bold',     fontSize: 15, lineHeight: 20 },
    // Secondary / supporting text
    secondary: { fontFamily: 'Manrope_500Medium',   fontSize: 13, lineHeight: 18 },
    // Small labels, chips, labels
    caption:   { fontFamily: 'Manrope_700Bold',     fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
    // Tiny monochrome data
    micro:     { fontFamily: 'Manrope_500Medium',   fontSize: 10, lineHeight: 13, letterSpacing: 1.2 },
    // Tab bar labels
    tab:       { fontFamily: 'Manrope_700Bold',     fontSize: 10, lineHeight: 12, letterSpacing: 0.3 },
    // Paragraph / wish text
    paragraph: { fontFamily: 'Manrope_500Medium',   fontSize: 16, lineHeight: 26 },
  },
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
  /** Standard screen horizontal padding */
  screen: 22,
  /** Space below status bar before content starts */
  statusBarOffset: 56,
  /** Bottom tab bar height (total) */
  tabBarHeight: 78,
  /** Safe-area bottom padding on notched iPhones */
  homeIndicator: 34,
} as const;

export const shadow = {
  // Lifted card — used for the hero card
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  },
  // Subtle row
  row: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  // Tab bar glass
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Aegean Noon  (primary / recommended theme)
// Hellenic cobalt hero, whitewashed cards, amber accent.
// ─────────────────────────────────────────────────────────────────────────────
export const aegeanNoon = {
  name: 'aegean_noon' as const,

  // Backgrounds
  /** Main screen background (use as a LinearGradient #F8FBFD → #EAF2F8) */
  bgTop:       '#F8FBFD',
  bgBottom:    '#EAF2F8',
  /** Card / surface background */
  surface:     '#FFFFFF',
  /** Secondary surface — date chip bg, input bg, secondary cards */
  surface2:    '#DDE9F2',

  // Typography
  /** Primary text */
  ink:         '#0E2238',
  /** Secondary / muted text */
  muted:       '#5C7390',

  // Lines & borders
  line:        'rgba(15, 76, 129, 0.10)',

  // Accent — Hellenic cobalt (use for active tab, CTA buttons, selected states)
  accent:      '#0F4C81',
  accentDark:  '#0A3561',
  accentSoft:  'rgba(15, 76, 129, 0.10)',

  // Hero card
  /** Hero card background (solid cobalt — LinearGradient #0F4C81 → #134F84) */
  heroBgTop:   '#0F4C81',
  heroBgBottom:'#134F84',
  heroInk:     '#FFFFFF',
  /** Large number + "Στείλε" pill background in hero */
  heroAccent:  '#FFC93C',
  /** Text on heroAccent pill */
  heroAccentInk: '#3A2A0A',

  // Chips (nameday/birthday type badges)
  chipBg:      '#FFE9A8',
  chipInk:     '#7A5A00',

  // Radius
  radius: {
    card:      20,
    hero:      24,
    chip:      99,
    avatar:    99,
    icon:      12,
    input:     14,
    sheet:     28,
    tab:       22,
  },

  // Misc
  dark: false,
  glass: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Sunset Blur  (secondary / alternate theme)
// Pastel lavender–peach gradient, frosted-glass cards, violet accent.
// ─────────────────────────────────────────────────────────────────────────────
export const sunsetBlur = {
  name: 'sunset_blur' as const,

  bgTop:       '#ECE0F8',
  bgMid:       '#FFE0D2',
  bgBottom:    '#FFD7E0',
  /** Use with BlurView (iOS) or semi-transparent #fff for Android */
  surface:     'rgba(255, 255, 255, 0.65)',
  surface2:    'rgba(255, 255, 255, 0.45)',

  ink:         '#2A1538',
  muted:       '#6E5A78',
  line:        'rgba(40, 15, 60, 0.10)',

  accent:      '#8F6FFF',
  accentDark:  '#5B40D1',
  accentSoft:  'rgba(143, 111, 255, 0.12)',

  // Hero: LinearGradient 135° #FFB088 → #FF7AA2 (55%) → #8F6FFF
  heroBgStart:  '#FFB088',
  heroBgMid:    '#FF7AA2',
  heroBgEnd:    '#8F6FFF',
  heroInk:      '#FFFFFF',
  heroAccent:   '#FFF2A8',
  heroAccentInk:'#3A2A0A',

  chipBg:      'rgba(143, 111, 255, 0.15)',
  chipInk:     '#5B40D1',

  radius: {
    card:      24,
    hero:      32,
    chip:      99,
    avatar:    99,
    icon:      14,
    input:     16,
    sheet:     28,
    tab:       22,
  },

  dark: false,
  glass: true, // cards use BlurView
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared semantic aliases — use these in components so switching theme
// requires only a context update, not hunting down hardcoded values.
// ─────────────────────────────────────────────────────────────────────────────
export type Theme = typeof aegeanNoon | typeof sunsetBlur;

/** Build a flat semantic token map from a raw theme object. */
export function buildTheme(t: Theme) {
  return {
    ...t,
    // convenient aliases
    textPrimary:   t.ink,
    textSecondary: t.muted,
    border:        t.line,
    buttonBg:      t.accent,
    buttonText:    '#FFFFFF',
    destructive:   '#E04F6A',
    success:       '#3C8F5E',
    warning:       t.heroAccent,
    gold:          '#FFC93C', // nameday gold ring on avatars
    goldDark:      '#8E6E2A',
  };
}

/** Default export — Aegean Noon. Swap to sunsetBlur via ThemeContext. */
export const theme = buildTheme(aegeanNoon);
