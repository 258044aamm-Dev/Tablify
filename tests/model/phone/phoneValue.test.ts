// SAD-303 — phone value rules: parsing, E.164 storage, display, tel links, default country.
import { describe, it, expect } from 'vitest';
import {
  FALLBACK_COUNTRY,
  defaultCountryFor,
  formatAsYouType,
  formatPhoneDisplay,
  isSupportedCountryCode,
  isValidPhone,
  parsePhone,
  regionOfLocale,
  splitStored,
  telHref,
  toE164,
} from '../../../src/model/phone/phoneValue.js';

describe('toE164 — the storage rule', () => {
  it('converts a national number with the field default country', () => {
    expect(toE164('01712-345678', 'BD')).toBe('+8801712345678');
    expect(toE164('01712345678', 'BD')).toBe('+8801712345678');
    expect(toE164('(415) 555-2671', 'US')).toBe('+14155552671');
  });

  it('normalises a valid international number with no default at all', () => {
    expect(toE164('+880 1712-345678')).toBe('+8801712345678');
    expect(toE164('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('does not guess a country for a national number', () => {
    expect(toE164('01712-345678')).toBeNull();
    expect(toE164('555-1234')).toBeNull();
  });

  it('refuses values that are not valid numbers', () => {
    expect(toE164('12345', 'BD')).toBeNull();
    expect(toE164('555-1234', 'US')).toBeNull();
    expect(toE164('abc', 'US')).toBeNull();
    expect(toE164('2024-01-01', 'US')).toBeNull();
    expect(toE164('', 'BD')).toBeNull();
  });

  it('ignores an unsupported default country instead of throwing', () => {
    expect(toE164('01712-345678', 'ZZ')).toBeNull();
    expect(toE164('+8801712345678', 'bd')).toBe('+8801712345678');
  });

  it('keeps 16+ digit strings out of E.164 (the standard caps at 15)', () => {
    expect(toE164('+12345678901234567', 'US')).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('mirrors toE164', () => {
    expect(isValidPhone('01712345678', 'BD')).toBe(true);
    expect(isValidPhone('12345', 'BD')).toBe(false);
  });
});

describe('parsePhone', () => {
  it('returns the country, national text and E.164 of a valid number', () => {
    const parts = parsePhone('+8801712345678', 'BD');
    expect(parts.country).toBe('BD');
    expect(parts.e164).toBe('+8801712345678');
    expect(parts.national).toBe('01712-345678');
  });

  it('keeps unparseable text verbatim', () => {
    const parts = parsePhone('call me', 'BD');
    expect(parts.e164).toBeNull();
    expect(parts.national).toBe('call me');
    expect(parts.country).toBe('BD');
  });

  it('treats empty input as empty', () => {
    expect(parsePhone('', 'BD')).toEqual({ country: 'BD', national: '', e164: null });
  });
});

describe('formatPhoneDisplay — what a cell shows', () => {
  it('formats a stored E.164 value in the international style', () => {
    expect(formatPhoneDisplay('+8801712345678')).toBe('+880 1712 345678');
    expect(formatPhoneDisplay('+14155552671')).toBe('+1 415 555 2671');
    expect(formatPhoneDisplay('+15551234567')).toBe('+1 555 123 4567');
  });

  it('shows an unparseable value exactly as stored (legacy files)', () => {
    expect(formatPhoneDisplay('+1 555-1234')).toBe('+1 555-1234');
    expect(formatPhoneDisplay('tel 12')).toBe('tel 12');
  });

  it('also formats a plausible-but-not-valid number (a placeholder like 555-0123)', () => {
    // Display never writes anything, so a possible number gets its proper shape even though
    // storage insists on a valid one.
    expect(formatPhoneDisplay('+15551234567')).toBe('+1 555 123 4567');
  });

  it('is empty for empty values and stringifies odd ones', () => {
    expect(formatPhoneDisplay(null)).toBe('');
    expect(formatPhoneDisplay(undefined)).toBe('');
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay(42 as unknown as string)).toBe('42');
  });
});

describe('telHref', () => {
  it('uses E.164 for a valid number', () => {
    expect(telHref('+15551234567')).toBe('tel:+15551234567');
    expect(telHref('+880 1712-345678')).toBe('tel:+8801712345678');
  });

  it('keeps the old loose rule for a legacy value, so existing links still work', () => {
    expect(telHref('+1 555-1234')).toBe('tel:+1 555-1234');
    expect(telHref('12')).toBeNull();
    expect(telHref('abc')).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});

describe('formatAsYouType', () => {
  it('formats a partial national number the way the country writes it', () => {
    expect(formatAsYouType('01712345678', 'BD')).toBe('01712-345678');
    expect(formatAsYouType('4155552671', 'US')).toBe('(415) 555-2671');
  });

  it('never throws on junk or an unknown country', () => {
    expect(formatAsYouType('abc', 'BD')).toBe('abc');
    expect(formatAsYouType('01712', 'ZZ')).toBe('01712');
  });
});

describe('defaultCountryFor', () => {
  it('prefers the field default', () => {
    expect(defaultCountryFor({ phoneCountry: 'BD' }, 'en-GB')).toBe('BD');
  });

  it('falls back to the reader region, then US', () => {
    expect(defaultCountryFor({}, 'en-GB')).toBe('GB');
    expect(defaultCountryFor(undefined, 'bn-BD')).toBe('BD');
    expect(defaultCountryFor({}, '')).toBe(FALLBACK_COUNTRY);
    expect(defaultCountryFor({}, 'xx')).toBe(FALLBACK_COUNTRY);
  });

  it('ignores a malformed or unsupported field default', () => {
    expect(defaultCountryFor({ phoneCountry: 'bd' }, 'en-GB')).toBe('GB');
    expect(defaultCountryFor({ phoneCountry: 'ZZ' }, 'en-GB')).toBe('GB');
  });
});

describe('regionOfLocale', () => {
  it('reads the region from a tag', () => {
    expect(regionOfLocale('en-GB')).toBe('GB');
    expect(regionOfLocale('bn-BD')).toBe('BD');
    expect(regionOfLocale('pt_BR')).toBe('BR');
  });

  it('returns null when there is no usable region', () => {
    expect(regionOfLocale('')).toBeNull();
    expect(regionOfLocale(undefined)).toBeNull();
    expect(regionOfLocale('en')).toBeNull();
    expect(regionOfLocale('!!!')).toBeNull();
  });
});

describe('splitStored — what the editor opens with', () => {
  it('splits a stored E.164 value into its country and national text', () => {
    const parts = splitStored('+8801712345678', { phoneCountry: 'US' }, 'en-US');
    expect(parts.country).toBe('BD');
    expect(parts.national).toBe('01712-345678');
    expect(parts.e164).toBe('+8801712345678');
  });

  it('uses the field default for an empty cell', () => {
    expect(splitStored(null, { phoneCountry: 'BD' })).toEqual({ country: 'BD', national: '', e164: null });
  });

  it('hands an unparseable value back verbatim, with the default country', () => {
    // A value that is not certifiably valid is never reshaped: the user sees their own text.
    const parts = splitStored('+1 555-1234', { phoneCountry: 'BD' }, '');
    expect(parts.national).toBe('+1 555-1234');
    expect(parts.country).toBe('BD');
    expect(parts.e164).toBeNull();
  });

  it('does not confuse a possible number with a valid one', () => {
    // 555-0123 is possible, not valid: the editor keeps it raw and no E.164 is claimed.
    const parts = splitStored('+15551234567', { phoneCountry: 'US' });
    expect(parts.e164).toBeNull();
    expect(parts.national).toBe('+15551234567');
  });
});

describe('isSupportedCountryCode', () => {
  it('accepts two uppercase letters the parser knows', () => {
    expect(isSupportedCountryCode('BD')).toBe(true);
    expect(isSupportedCountryCode('bd')).toBe(false);
    expect(isSupportedCountryCode('ZZ')).toBe(false);
    expect(isSupportedCountryCode(42)).toBe(false);
  });
});
