export const Colors = {
  background: '#000000',
  card: '#0D0D0D',
  cardElevated: '#141414',
  border: '#1A1A1A',
  primary: '#7B2FFF',
  primaryEnd: '#3B5BDB',
  accent: '#A855F7',
  textPrimary: '#FFFFFF',
  textSecondary: '#6B7280',
  textMuted: '#374151',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  amber: '#F59E0B',

  // Legacy aliases so existing code doesn't break
  bg: '#000000',
  text: '#FFFFFF',
  error: '#EF4444',
} as const;

export const GradientColors: [string, string] = ['#7B2FFF', '#3B5BDB'];

export const Fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  semiBold: 'SpaceGrotesk_600SemiBold', // legacy alias
  bold: 'SpaceGrotesk_700Bold',
  extrabold: 'SpaceGrotesk_700Bold',    // package tops at 700
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Typography = {
  h1: { fontSize: 28, fontFamily: Fonts.bold, color: Colors.textPrimary },
  h2: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  h3: { fontSize: 18, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  body: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.textPrimary },
  caption: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  mono: { fontSize: 13, fontFamily: 'monospace' as const, color: Colors.textPrimary },
} as const;
