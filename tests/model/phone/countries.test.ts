// SAD-303 — country data and search for the phone picker. Pure model, no DOM.
import { describe, it, expect } from 'vitest';
import {
  allCountries,
  countryRow,
  isPhoneHeader,
  isSupportedCountryCode,
  searchCountries,
} from '../../../src/model/phone/countries.js';

describe('allCountries', () => {
  it('lists every region the parser supports, once each', () => {
    const rows = allCountries();
    expect(rows).toHaveLength(245);
    expect(new Set(rows.map((r) => r.iso)).size).toBe(rows.length);
  });

  it('carries dial codes without a plus', () => {
    const byIso = new Map(allCountries().map((r) => [r.iso, r]));
    expect(byIso.get('BD')?.dial).toBe('880');
    expect(byIso.get('US')?.dial).toBe('1');
    expect(byIso.get('GB')?.dial).toBe('44');
    expect(byIso.get('IN')?.dial).toBe('91');
  });

  it('names every row in English, always', () => {
    for (const row of allCountries()) {
      expect(row.english.length).toBeGreaterThan(1);
      expect(row.name.length).toBeGreaterThan(1);
    }
    expect(countryRow('BD')?.english).toBe('Bangladesh');
    expect(countryRow('US')?.english).toBe('United States');
  });

  it('is sorted by localised name', () => {
    const names = allCountries().map((r) => r.name);
    const sorted = [...names].sort(new Intl.Collator('en', { sensitivity: 'base' }).compare);
    expect(names).toEqual(sorted);
  });

  it('falls back to the English name when a locale is not understood', () => {
    // Intl.DisplayNames throws a RangeError for a malformed tag; the module must not.
    expect(countryRow('BD', '!!!')?.name).toBe('Bangladesh');
  });

  it('returns undefined for unknown codes, and accepts a lowercase code', () => {
    expect(countryRow('ZZ')).toBeUndefined();
    expect(countryRow('')).toBeUndefined();
    // Lookup is lenient about case; validation (isSupportedCountryCode) is not.
    expect(countryRow('bd')?.iso).toBe('BD');
  });
});

describe('searchCountries', () => {
  it('returns every country for an empty query', () => {
    expect(searchCountries('')).toHaveLength(245);
    expect(searchCountries('   ')).toHaveLength(245);
  });

  it('finds a country by a name prefix', () => {
    expect(searchCountries('bangla')[0]?.iso).toBe('BD');
  });

  it('finds a country by ISO code, in either case', () => {
    expect(searchCountries('gb')[0]?.iso).toBe('GB');
    expect(searchCountries('GB')[0]?.iso).toBe('GB');
  });

  it('finds a country by dial code, with or without the plus', () => {
    expect(searchCountries('880')[0]?.iso).toBe('BD');
    expect(searchCountries('+880')[0]?.iso).toBe('BD');
  });

  it('understands the names people actually type', () => {
    expect(searchCountries('uk')[0]?.iso).toBe('GB');
    expect(searchCountries('usa')[0]?.iso).toBe('US');
    expect(searchCountries('uae')[0]?.iso).toBe('AE');
    expect(searchCountries('holland')[0]?.iso).toBe('NL');
  });

  it('treats one digit as an exact dial code, not a prefix', () => {
    // 25 regions share dial code 1 (the NANP). They are exact matches and come back together,
    // alphabetically; no other country is dragged in by a one-digit prefix.
    const rows = searchCountries('1');
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.length).toBeLessThan(30);
    expect(rows.every((row) => row.dial === '1')).toBe(true);
    expect(rows.some((row) => row.iso === 'US')).toBe(true);
    expect(searchCountries('+1').map((row) => row.iso)).toEqual(rows.map((row) => row.iso));
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchCountries('zzzzzz')).toEqual([]);
  });
});

describe('isPhoneHeader', () => {
  it('accepts the words a phone column uses', () => {
    for (const header of ['Phone', 'Phone Number', 'Mobile', 'Cell phone', 'Contact TEL', 'WhatsApp', 'মোবাইল নম্বর']) {
      expect(isPhoneHeader(header), header).toBe(true);
    }
  });

  it('matches whole tokens, never substrings', () => {
    for (const header of ['Phonebook ID', 'Microphone', 'Headphone', 'Telegram', 'Notes']) {
      expect(isPhoneHeader(header), header).toBe(false);
    }
  });

  it('handles empty and non-string input', () => {
    expect(isPhoneHeader('')).toBe(false);
    expect(isPhoneHeader('   ')).toBe(false);
    expect(isPhoneHeader(undefined as unknown as string)).toBe(false);
  });
});

describe('isSupportedCountryCode', () => {
  it('accepts only two uppercase letters the parser knows', () => {
    expect(isSupportedCountryCode('BD')).toBe(true);
    expect(isSupportedCountryCode('XK')).toBe(true);
    expect(isSupportedCountryCode('bd')).toBe(false);
    expect(isSupportedCountryCode('BGD')).toBe(false);
    expect(isSupportedCountryCode('ZZ')).toBe(false);
    expect(isSupportedCountryCode(null)).toBe(false);
  });
});
