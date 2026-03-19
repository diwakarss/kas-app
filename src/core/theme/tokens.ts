export const colors = {
  dawn: '#FAF7F2',
  dusk: '#1A1614',
  clay: '#3D3530',
  mist: '#B8AFA6',
  ember: '#D4845A',
  bloom: '#6B9E78',
  stream: '#5B8BA4',
} as const;

export type ColorToken = keyof typeof colors;

/** Map spec color names to hex values */
export function resolveColor(token: string): string {
  return colors[token as ColorToken] ?? colors.mist;
}

export const typography = {
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: colors.clay,
  },
  subheading: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: colors.clay,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.clay,
  },
  secondary: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.mist,
  },
  action: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.stream,
  },
  warning: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.ember,
  },
} as const;

export type TypographyStyle = keyof typeof typography;

export const cardStyle = {
  backgroundColor: colors.dawn,
  borderRadius: 16,
  padding: 16,
  shadowColor: 'rgba(61,53,48,0.08)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 8,
  elevation: 2,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
