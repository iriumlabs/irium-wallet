export const Colors = {
  bg: '#030308',
  card: '#0C0C1A',
  border: '#1A1A2E',
  primary: '#7B3FE4',
  secondary: '#3B5BDB',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

export const GradientColors: [string, string] = ['#7B2FFF', '#3B5BDB'];

export const Fonts = {
  regular: 'SpaceGrotesk_400Regular',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
};

export const Typography = {
  h1: { fontSize: 28, fontFamily: Fonts.bold, color: Colors.text },
  h2: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.text },
  h3: { fontSize: 18, fontFamily: Fonts.semiBold, color: Colors.text },
  body: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.text },
  caption: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted },
  mono: { fontSize: 13, fontFamily: 'monospace' as const, color: Colors.text },
};
