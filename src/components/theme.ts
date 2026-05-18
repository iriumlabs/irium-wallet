// ─── Color tokens ────────────────────────────────────────────────────────────
// Deep-space palette. The values match the redesign spec; existing color names
// are kept and re-pointed so every screen picks up the new look automatically.

export const Colors = {
  // Surfaces
  background:          '#000005',
  backgroundSecondary: '#05050F',
  card:                '#0A0A1A',
  cardElevated:        '#0F0F20',
  border:              '#1A1A2E',
  borderSubtle:        '#12122A',

  // Brand
  primary:          '#7B2FFF',
  primaryLight:     '#9B4FFF',
  primaryEnd:       '#3B5BDB', // legacy — kept for the old purple→blue gradient consumers
  accent:           '#00D4FF',
  accentSecondary:  '#A855F7',
  gradientStart:    '#7B2FFF',
  gradientEnd:      '#00D4FF',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#8892A4',
  textMuted:     '#4B5563',

  // Semantic
  success: '#00D4A0',
  warning: '#F59E0B',
  danger:  '#FF4466',
  amber:   '#F59E0B',

  // Legacy aliases — existing code uses these
  bg:    '#000005',
  text:  '#FFFFFF',
  error: '#FF4466',
} as const;

// New brand gradient (purple → cyan). Replaces the old purple → blue.
export const GradientColors: [string, string] = ['#7B2FFF', '#00D4FF'];

// Secondary purple gradient (kept for places that want a warmer brand swirl)
export const GradientPurple: [string, string] = ['#7B2FFF', '#A855F7'];

// Glass-card overlay (use over dark backgrounds with a 1px gradient border)
export const GlassFill: [string, string] = ['rgba(123,47,255,0.12)', 'rgba(0,212,255,0.06)'];

// ─── Typography tokens ───────────────────────────────────────────────────────

export const Fonts = {
  regular:   'SpaceGrotesk_400Regular',
  medium:    'SpaceGrotesk_500Medium',
  semibold:  'SpaceGrotesk_600SemiBold',
  semiBold:  'SpaceGrotesk_600SemiBold', // legacy alias
  bold:      'SpaceGrotesk_700Bold',
  extrabold: 'SpaceGrotesk_700Bold',     // package tops at 700
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20,
  '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48,
} as const;

export const Radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
} as const;

export const Typography = {
  h1:      { fontSize: 28, fontFamily: Fonts.bold,     color: Colors.textPrimary },
  h2:      { fontSize: 22, fontFamily: Fonts.bold,     color: Colors.textPrimary },
  h3:      { fontSize: 18, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  body:    { fontSize: 15, fontFamily: Fonts.regular,  color: Colors.textPrimary },
  caption: { fontSize: 13, fontFamily: Fonts.regular,  color: Colors.textSecondary },
  mono:    { fontSize: 13, fontFamily: 'monospace' as const, color: Colors.textPrimary },
} as const;
