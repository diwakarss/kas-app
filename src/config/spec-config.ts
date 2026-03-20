/**
 * Spec selection configuration.
 * Change ACTIVE_SPEC to switch which business app the renderer loads.
 * Future: dynamic spec switching via AsyncStorage or remote fetch.
 */
export type SpecName = 'tutor' | 'shopkeeper' | 'restaurant' | 'doctor';

export const ACTIVE_SPEC: SpecName = 'restaurant';
