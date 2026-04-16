/**
 * Design System Tokens
 * Matching the Expo app design system ("Liquid Story")
 */

export const colors = {
  dawn: '#FAF7F2',
  dusk: '#1A1614',
  clay: '#3D3530',
  mist: '#B8AFA6',
  ember: '#D4845A',
  bloom: '#6B9E78',
  stream: '#5B8BA4',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

export const fontSizes = {
  xs: '12px',
  sm: '13px',
  base: '14px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
} as const;

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
} as const;

export const shadows = {
  card: '0 2px 8px rgba(61, 53, 48, 0.08)',
  elevated: '0 4px 16px rgba(61, 53, 48, 0.12)',
} as const;

export const breakpoints = {
  mobile: '768px',
  tablet: '1024px',
} as const;
