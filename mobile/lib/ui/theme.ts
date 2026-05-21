/**
 * Celebrations — Design Token System
 * Generated from design prototype (Aegean Noon + Sunset Blur themes).
 *
 * Usage:
 *   import { theme, typography, spacing, shadow } from '@/lib/ui/theme';
 *   style={{ color: theme.ink, borderRadius: theme.radius.card }}
 *
 * Active theme is Aegean Noon (default export). Sunset Blur is exported for future ThemeContext swap.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared design tokens (same across both themes)
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  /** Display / headings — numbers, dates, section titles */
  display: {
    fontFamily: 'PlusJakartaSans_700Bold',
    hero:      { fontSize: 80, lineHeight: 72, letterSpacing: -1.5 },
    title:     { fontSize: 34, lineHeight: 36, letterSpacing: -0.5 },
    section:   { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
    dateChip:  { fontSize: 22, lineHeight: 24, letterSpacing: -0.3 },
  },
  /** Body / UI copy */
  body: {
    fontFamily: 'Manrope_600SemiBold',
    primary:   { fontFamily: 'Manrope_700Bold',     fontSize: 15, lineHeight: 20 },
    secondary: { fontFamily: 'Manrope_500Medium',   fontSize: 13, lineHeight: 18 },
    caption:   { fontFamily: 'Manrope_700Bold',     fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
    micro:     { fontFamily: 'Manrope_500Medium',   fontSize: 10, lineHeight: 13, letterSpacing: 1.2 },
    tab:       { fontFamily: 'Manrope_700Bold',     fontSize: 10, lineHeight: 12, letterSpacing: 0.3 },
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
  screen: 22,
  statusBarOffset: 56,
  tabBarHeight: 78,
  homeIndicator: 34,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  },
  row: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Aegean Noon — Hellenic cobalt hero, whitewashed cards, amber accent.
// ─────────────────────────────────────────────────────────────────────────────
export const aegeanNoon = {
  name: 'aegean_noon' as const,
  bgTop:       '#F8FBFD',
  bgBottom:    '#EAF2F8',
  surface:     '#FFFFFF',
  surface2:    '#DDE9F2',
  ink:         '#0E2238',
  muted:       '#5C7390',
  line:        'rgba(15, 76, 129, 0.10)',
  accent:      '#0F4C81',
  accentDark:  '#0A3561',
  accentSoft:  'rgba(15, 76, 129, 0.10)',
  heroBgTop:   '#0F4C81',
  heroBgBottom:'#134F84',
  heroInk:     '#FFFFFF',
  heroAccent:  '#FFC93C',
  heroAccentInk: '#3A2A0A',
  chipBg:      '#FFE9A8',
  chipInk:     '#7A5A00',
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
  dark: false,
  glass: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Sunset Blur — Pastel lavender→peach, frosted glass, violet accent.
// ─────────────────────────────────────────────────────────────────────────────
export const sunsetBlur = {
  name: 'sunset_blur' as const,
  bgTop:       '#ECE0F8',
  bgMid:       '#FFE0D2',
  bgBottom:    '#FFD7E0',
  surface:     'rgba(255, 255, 255, 0.65)',
  surface2:    'rgba(255, 255, 255, 0.45)',
  ink:         '#2A1538',
  muted:       '#6E5A78',
  line:        'rgba(40, 15, 60, 0.10)',
  accent:      '#8F6FFF',
  accentDark:  '#5B40D1',
  accentSoft:  'rgba(143, 111, 255, 0.12)',
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
  glass: true,
} as const;

export type RawTheme = typeof aegeanNoon | typeof sunsetBlur;

export function buildTheme<T extends RawTheme>(t: T) {
  return {
    ...t,
    textPrimary:   t.ink,
    textSecondary: t.muted,
    border:        t.line,
    buttonBg:      t.accent,
    buttonText:    '#FFFFFF',
    destructive:   '#E04F6A',
    success:       '#3C8F5E',
    warning:       t.heroAccent,
    gold:          '#FFC93C',
    goldDark:      '#8E6E2A',
  };
}

/** Default export — Aegean Noon. */
export const theme = buildTheme(aegeanNoon);
export type Theme = typeof theme;
