import type { L10n, L10nList, Locale } from './types';

/** Resolve a localised string, falling back to French (always present). */
export function t(value: L10n | undefined, locale: Locale = 'fr'): string {
  if (!value) return '';
  return value[locale] ?? value.fr;
}

/** Resolve a localised string list, falling back to French. */
export function tList(value: L10nList | undefined, locale: Locale = 'fr'): string[] {
  if (!value) return [];
  return value[locale] ?? value.fr;
}
