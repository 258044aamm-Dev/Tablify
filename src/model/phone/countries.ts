// Country data for the phone field (SAD-303). Pure model code: no Obsidian, no DOM.
//
// The list is generated from `libphonenumber-js`'s supported regions (245 at the pinned
// version) so it can never disagree with the parser about whether a country exists. Names
// come from `Intl.DisplayNames` — the platform's own region names, localised — rather than a
// shipped table of 245 English strings. If a platform ever lacks `DisplayNames`, the ISO
// code is used instead: a readable fallback, never a crash.
//
// Search is deliberately generous, because people look for a country by whatever they have in
// front of them: its name (`bangla`), its code (`bd`), its dial code (`880`, `+880`), or a
// familiar alias (`uk`, `usa`, `uae`). Ranking is deterministic (score, then name), so the
// tests can assert an exact order.

import { getCountries, getCountryCallingCode, isSupportedCountry } from 'libphonenumber-js/min';

/** One row of the picker. */
export interface CountryRow {
  /** ISO 3166-1 alpha-2, uppercase: "BD". */
  iso: string;
  /** International dialling code without the plus: "880". */
  dial: string;
  /** Localised name, e.g. "Bangladesh" (en) or "বাংলাদেশ" (bn). */
  name: string;
  /** English name, always present, used for search and stable tests. */
  english: string;
}

const DEFAULT_LOCALE = 'en';

/**
 * Words that make a column header say "this column is a phone number". Matched as whole
 * tokens (never substrings), so `Phonebook ID` does not qualify but `Telephone notes` does.
 * A few common non-English words are included because import files are not always English.
 */
export const PHONE_HEADER_TOKENS: ReadonlySet<string> = new Set([
  'phone',
  'phones',
  'mobile',
  'mobiles',
  'cell',
  'cellphone',
  'tel',
  'telephone',
  'telefon',
  'tlf',
  'fone',
  'fono',
  'whatsapp',
  'whats',
  'handy',
  'movil',
  'celular',
  'mobitel',
  'মোবাইল',
  'ফোন',
  '电话',
  '手机',
  '手機',
]);

/**
 * Familiar names that are not the ISO name. Keys are lowercase; values are ISO codes.
 * Only the names people actually type — the list stays short on purpose.
 */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  uk: 'GB',
  'u.k.': 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  usa: 'US',
  'u.s.a.': 'US',
  america: 'US',
  'united states of america': 'US',
  uae: 'AE',
  holland: 'NL',
  burma: 'MM',
  'ivory coast': 'CI',
  'czech republic': 'CZ',
  swaziland: 'SZ',
  macedonia: 'MK',
  turkey: 'TR',
  russia: 'RU',
  vietnam: 'VN',
  laos: 'LA',
  syria: 'SY',
  iran: 'IR',
  bolivia: 'BO',
  tanzania: 'TZ',
  venezuela: 'VE',
  moldova: 'MD',
  'south korea': 'KR',
  'north korea': 'KP',
};

/** Localised name for a region, or the fallback when `Intl.DisplayNames` is unavailable. */
function regionName(iso: string, locale: string, fallback: string): string {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return fallback;
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(iso);
    return name && name !== iso ? name : fallback;
  } catch {
    return fallback;
  }
}

function collatorFor(locale: string): Intl.Collator {
  try {
    return new Intl.Collator(locale, { sensitivity: 'base' });
  } catch {
    return new Intl.Collator(DEFAULT_LOCALE, { sensitivity: 'base' });
  }
}

const listCache = new Map<string, readonly CountryRow[]>();

/** Every supported country, sorted by localised name. Memoised per locale. */
export function allCountries(locale: string = DEFAULT_LOCALE): readonly CountryRow[] {
  const key = locale || DEFAULT_LOCALE;
  const cached = listCache.get(key);
  if (cached) return cached;

  const englishNames = new Map<string, string>();
  const rows: CountryRow[] = getCountries().map((iso) => {
    const english = regionName(iso, DEFAULT_LOCALE, iso);
    englishNames.set(iso, english);
    return {
      iso,
      dial: getCountryCallingCode(iso),
      name: key === DEFAULT_LOCALE ? english : regionName(iso, key, english),
      english,
    };
  });
  rows.sort((a, b) => collatorFor(key).compare(a.name, b.name) || a.iso.localeCompare(b.iso));
  listCache.set(key, rows);
  return rows;
}

/** One country by ISO code, or undefined for an unknown/unsupported code. */
export function countryRow(iso: string, locale: string = DEFAULT_LOCALE): CountryRow | undefined {
  if (typeof iso !== 'string') return undefined;
  const upper = iso.trim().toUpperCase();
  if (!isSupportedCountryCode(upper)) return undefined;
  return allCountries(locale).find((row) => row.iso === upper);
}

/** True for a two-letter uppercase code the parser knows. Never throws. */
export function isSupportedCountryCode(iso: unknown): iso is string {
  return typeof iso === 'string' && /^[A-Z]{2}$/.test(iso) && isSupportedCountry(iso);
}

/** True when a header names a phone column (whole-token match, unicode-aware). */
export function isPhoneHeader(header: string): boolean {
  if (typeof header !== 'string' || header.trim() === '') return false;
  // \p{M} keeps combining marks attached to their base letter: without it, Bengali
  // "মোবাইল" would split into "ম", "ব", "ইল" at every vowel sign.
  const tokens = header
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((token) => token !== '');
  return tokens.some((token) => PHONE_HEADER_TOKENS.has(token));
}

function scoreRow(row: CountryRow, query: string, digits: string, digitsOnly: boolean): number | null {
  const name = row.name.toLowerCase();
  const english = row.english.toLowerCase();
  const iso = row.iso.toLowerCase();

  if (query === iso) return 0;
  if (digitsOnly && digits === row.dial) return 0;
  if (COUNTRY_ALIASES[query] === row.iso) return 0;

  if (name.startsWith(query) || english.startsWith(query)) return 1;
  if (name.split(/[^\p{L}\p{M}\p{N}]+/u).some((token) => token.startsWith(query))) return 2;
  if (name.includes(query) || english.includes(query)) return 3;

  // A dial-code prefix ("+88" → +880, +886, …), but not a single digit: one digit matches
  // dozens of countries and is never a useful query.
  if (digitsOnly && digits.length >= 2 && row.dial.startsWith(digits)) return 4;
  return null;
}

/**
 * Countries matching a free-text query, best match first. An empty query returns every row
 * in name order. Never returns more than the full list; never throws.
 */
export function searchCountries(query: string, locale: string = DEFAULT_LOCALE): readonly CountryRow[] {
  const rows = allCountries(locale);
  const raw = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (raw === '') return rows;

  const digits = raw.replace(/^\+/, '').replace(/[\s().-]/g, '');
  const digitsOnly = /^\d+$/.test(digits);
  const collator = collatorFor(locale);

  const scored: Array<{ row: CountryRow; score: number }> = [];
  for (const row of rows) {
    const score = scoreRow(row, raw, digits, digitsOnly);
    if (score !== null) scored.push({ row, score });
  }
  scored.sort(
    (a, b) => a.score - b.score || collator.compare(a.row.name, b.row.name) || a.row.iso.localeCompare(b.row.iso),
  );
  return scored.map((entry) => entry.row);
}
