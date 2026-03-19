import { colors, ColorToken } from './tokens';

/**
 * Maps severity levels to color tokens.
 */
export const severityColors: Record<string, string> = {
  info: colors.stream,
  warning: colors.ember,
  urgent: colors.ember,
};

/**
 * Maps spec design token names (used in icon_color, etc.) to hex colors.
 */
export function specColorToHex(specToken: string): string {
  return colors[specToken as ColorToken] ?? colors.mist;
}
