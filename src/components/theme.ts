// ─── Color tokens — irium-core-aligned palette ───────────────────────────────
// Deep navy background, indigo accent, professional & flat.
// All previously-used names are kept as aliases so screens pick up new values
// without code edits.

export const Colors = {
  // Surfaces
  background:          '#0A0E1A',
  backgroundSecondary: '#0F1629',
  card:                '#0F1629',
  cardElevated:        '#15203A',
  border:              '#1E2A45',
  borderSubtle:        '#1E2A45',

  // Brand
  primary:          '#6366F1', // indigo
  primaryLight:     '#818CF8',
  primaryEnd:       '#6366F1', // flatten gradients to single color
  accent:           '#8B5CF6', // secondary purple
  accentSecondary:  '#8B5CF6',
  gradientStart:    '#6366F1',
  gradientEnd:      '#6366F1', // no visible gradient — flat indigo

  // Text
  textPrimary:   '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted:     '#64748B',

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  danger:  '#EF4444',
  amber:   '#F59E0B',

  // Legacy aliases
  bg:    '#0A0E1A',
  text:  '#F8FAFC',
  error: '#EF4444',
} as const;

// Flat indigo — consumers that use a "gradient" get a solid block instead.
export const GradientColors: [string, string] = ['#6366F1', '#6366F1'];

// Kept for compatibility — also flat.
export const GradientPurple: [string, string] = ['#8B5CF6', '#8B5CF6'];
export const GlassFill:      [string, string] = ['#0F1629', '#0F1629'];

// ─── Typography tokens ───────────────────────────────────────────────────────

export const Fonts = {
  regular:   'SpaceGrotesk_400Regular',
  medium:    'SpaceGrotesk_500Medium',
  semibold:  'SpaceGrotesk_600SemiBold',
  semiBold:  'SpaceGrotesk_600SemiBold', // legacy alias
  bold:      'SpaceGrotesk_700Bold',
  extrabold: 'SpaceGrotesk_700Bold',
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
