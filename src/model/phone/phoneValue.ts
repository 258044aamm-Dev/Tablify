// Phone value rules (SAD-303). Pure model code: no Obsidian, no DOM.
//
// One canonical stored form (E.164, e.g. "+8801712345678") and every derivation from it:
// the national text an editor shows, the international text a cell shows, and the `tel:`
// target. Display formatting lives here rather than in `phoneType.format()` on purpose:
// `format()` is used by grouping, type conversion and export, and changing it would silently
// reshape values in features this issue must not touch.

import { AsYouType, isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';
import type { CellValue, FieldDefinition } from '../types.js';

/** Used only when the field has no default and the reader's locale names no region. */
export const FALLBACK_COUNTRY = 'US';

export interface PhoneParts {
  /** ISO code the value belongs to (or the best known default), uppercase. */
  country: string | null;
  /** National text for an editor. The stored text verbatim when it cannot be parsed. */
  national: string;
  /** E.164, only when the text is a valid number. */
  e164: string | null;
}

/** The reader's locale, e.g. "bn-BD". Empty when there is no platform locale. */
export function readerLocale(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') return navigator.language;
  return '';
}

/** Region of a locale tag ("en-GB" → "GB"), or null when it has none or is unsupported. */
export function regionOfLocale(locale: string | undefined): CountryCode | null {
  if (!locale) return null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
      const region = new Intl.Locale(locale).region;
      if (region && isSupportedCountryCode(region)) return region;
    }
  } catch {
    // A malformed tag is not an error: fall through to the manual parse below.
  }
  const match = /^[a-z]{2,3}[-_]([a-zA-Z]{2})\b/.exec(locale);
  const region = match?.[1]?.toUpperCase() ?? '';
  return isSupportedCountryCode(region) ? region : null;
}

/** Two-letter uppercase code the parser knows. Never throws. */
export function isSupportedCountryCode(iso: unknown): iso is CountryCode {
  return typeof iso === 'string' && /^[A-Z]{2}$/.test(iso) && isSupportedCountry(iso as CountryCode);
}

/**
 * The country a phone field edits in: its own default, then the reader's region, then US.
 * An unsupported or malformed `phoneCountry` is ignored rather than trusted.
 */
export function defaultCountryFor(field: Pick<FieldDefinition, 'phoneCountry'> | undefined, locale?: string): CountryCode {
  const explicit = field?.phoneCountry;
  if (isSupportedCountryCode(explicit)) return explicit;
  return regionOfLocale(locale ?? readerLocale()) ?? FALLBACK_COUNTRY;
}

/**
 * Parse a phone number, optionally against a default country. Never throws.
 *
 * Only a *valid* number is split into a country and a national form; anything else keeps the
 * text exactly as given, because a value we are not sure about must never be reshaped.
 */
export function parsePhone(input: string, country?: string): PhoneParts {
  const text = typeof input === 'string' ? input.trim() : '';
  const fallback: CountryCode | null = isSupportedCountryCode(country) ? country : null;
  if (text === '') return { country: fallback, national: '', e164: null };

  const parsed = parsePhoneNumberFromString(text, fallback ?? undefined);
  if (!parsed?.isValid()) return { country: fallback, national: text, e164: null };
  return {
    country: parsed.country ?? fallback,
    national: parsed.formatNational(),
    e164: parsed.number,
  };
}

/**
 * The parser object when the text is at least *possible* for its country. Display and dialling
 * use this looser test: a plausible number (a placeholder like +1 555 123 4567 included) is
 * shown and dialled in its proper shape, while storage still demands `isValid()`.
 */
function possibleNumber(text: string, country?: string) {
  const parsed = parsePhoneNumberFromString(text, isSupportedCountryCode(country) ? country : undefined);
  if (!parsed) return null;
  return parsed.isPossible() || parsed.isValid() ? parsed : null;
}

/** E.164 for the text, or null when it is not a valid number. Never guesses a country. */
export function toE164(input: string, country?: string): string | null {
  return parsePhone(input, country).e164;
}

/** True when the text is a valid phone number (with or without a default country). */
export function isValidPhone(input: string, country?: string): boolean {
  return toE164(input, country) !== null;
}

/**
 * What a phone cell shows: the international form of a stored E.164 value, or the stored text
 * verbatim when it is not parseable (legacy national values included).
 */
export function formatPhoneDisplay(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  const text = value.trim();
  if (text === '') return '';
  const parsed = possibleNumber(text);
  return parsed ? parsed.formatInternational() : text;
}

/** Format a partial number the way the panel shows it while the user types. */
export function formatAsYouType(input: string, country: string | undefined): string {
  // AsYouType silently drops anything it does not recognise, so a stray letter would look
  // deleted while typing. Outside the phone alphabet the field is left exactly as typed.
  if (!/^[\d\s+\-().]*$/.test(input)) return input;
  const c = isSupportedCountryCode(country) ? country : undefined;
  try {
    return new AsYouType(c).input(input);
  } catch {
    return input;
  }
}

/**
 * Split a stored value for the editor: the country it belongs to, and the national text to
 * put in the number field. An unparseable value keeps its stored text and uses the field's
 * default country, so nothing is lost or rewritten.
 */
export function splitStored(
  value: CellValue | undefined,
  field: Pick<FieldDefinition, 'phoneCountry'> | undefined,
  locale?: string,
): PhoneParts {
  const fallback = defaultCountryFor(field, locale);
  if (typeof value !== 'string') return { country: fallback, national: '', e164: null };
  const text = value.trim();
  if (text === '') return { country: fallback, national: '', e164: null };

  const parsed = parsePhoneNumberFromString(text, fallback);
  if (parsed?.isValid()) {
    return {
      country: parsed.country ?? fallback,
      national: parsed.formatNational(),
      e164: parsed.number,
    };
  }
  // Not certainly valid: hand the user their own text back, unchanged.
  return { country: fallback, national: text, e164: null };
}

/**
 * `tel:` target: E.164 when the value is a valid number, otherwise the old loose rule's
 * sanitized text, so legacy values keep working exactly as before.
 */
export function telHref(value: CellValue | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '') return null;
  const parsed = possibleNumber(text);
  if (parsed) return `tel:${parsed.number}`;
  return /^\+?[\d][\d\s\-().]{4,}$/.test(text) ? `tel:${text}` : null;
}
