import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { serialize } from '../../src/format/serialize.js';
import { parse } from '../../src/format/parse.js';
import type { TablifyFile } from '../../src/model/types.js';

const SAMPLES_DIR = join(process.cwd(), 'samples');

describe('Serializer', () => {
  it('produces 2-space indented JSON with trailing newline', () => {
    const file = JSON.parse(readFileSync(join(SAMPLES_DIR, 'v1', 'empty.tablify'), 'utf-8'));
    const result = serialize(file as TablifyFile);

    expect(result.endsWith('\n')).toBe(true);
    expect(result.includes('  "formatVersion"')).toBe(true);
    // No tabs
    expect(result.includes('\t')).toBe(false);
    // LF line endings (no CR)
    expect(result.includes('\r')).toBe(false);
  });

  it('orders top-level keys correctly', () => {
    const file = JSON.parse(readFileSync(join(SAMPLES_DIR, 'v1', 'empty.tablify'), 'utf-8'));
    const result = serialize(file as TablifyFile);
    const keys = Object.keys(JSON.parse(result));

    expect(keys[0]).toBe('formatVersion');
    expect(keys[1]).toBe('tableId');
    expect(keys[2]).toBe('name');
    expect(keys[3]).toBe('fields');
    expect(keys[4]).toBe('rows');
    expect(keys[5]).toBe('views');
    expect(keys[6]).toBe('syncLink');
  });

  it('preserves unknown top-level keys', () => {
    const file = JSON.parse(readFileSync(join(SAMPLES_DIR, 'v1', 'edge.tablify'), 'utf-8'));
    expect(file.unknownTopLevel).toBeDefined();
    const result = serialize(file as TablifyFile);
    const parsed = JSON.parse(result);
    expect(parsed.unknownTopLevel).toBe('this key is unknown and should be preserved on round-trip');
  });

  it('round-trips empty.tablify byte-identical', () => {
    const original = readFileSync(join(SAMPLES_DIR, 'v1', 'empty.tablify'), 'utf-8');
    const file = JSON.parse(original) as TablifyFile;
    const serialized = serialize(file);
    expect(serialized).toBe(original);
  });

  it('round-trips typical.tablify byte-identical', () => {
    const original = readFileSync(join(SAMPLES_DIR, 'v1', 'typical.tablify'), 'utf-8');
    const file = JSON.parse(original) as TablifyFile;
    const serialized = serialize(file);
    expect(serialized).toBe(original);
  });

  it('round-trips edge.tablify byte-identical', () => {
    const original = readFileSync(join(SAMPLES_DIR, 'v1', 'edge.tablify'), 'utf-8');
    const file = JSON.parse(original) as TablifyFile;
    const serialized = serialize(file);
    expect(serialized).toBe(original);
  });
});

describe('Parser', () => {
  it('accepts empty.tablify', () => {
    const input = readFileSync(join(SAMPLES_DIR, 'v1', 'empty.tablify'), 'utf-8');
    const result = parse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.formatVersion).toBe(1);
    }
  });

  it('accepts typical.tablify', () => {
    const input = readFileSync(join(SAMPLES_DIR, 'v1', 'typical.tablify'), 'utf-8');
    const result = parse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.length).toBeGreaterThan(0);
    }
  });

  it('accepts edge.tablify with unknown keys', () => {
    const input = readFileSync(join(SAMPLES_DIR, 'v1', 'edge.tablify'), 'utf-8');
    const result = parse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as Record<string, unknown>).unknownTopLevel).toBeDefined();
    }
  });

  it('rejects invalid JSON', () => {
    const result = parse('{invalid json}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('rejects missing formatVersion', () => {
    const input = readFileSync(join(SAMPLES_DIR, 'invalid', 'missing-format-version.tablify'), 'utf-8');
    const result = parse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('formatVersion');
    }
  });

  it('rejects wrong formatVersion', () => {
    const result = parse(JSON.stringify({ formatVersion: 2, tableId: 't', name: 'n', fields: [], rows: [], views: [], syncLink: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unsupported formatVersion');
    }
  });

  it('rejects non-object input', () => {
    const result = parse('"just a string"');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('JSON object');
    }
  });

  it('rejects rows with non-integer rev', () => {
    const input = readFileSync(join(SAMPLES_DIR, 'invalid', 'wrong-type.tablify'), 'utf-8');
    const result = parse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('rev');
    }
  });

  it('rejects non-null syncLink', () => {
    const file = JSON.parse(readFileSync(join(SAMPLES_DIR, 'v1', 'empty.tablify'), 'utf-8'));
    file.syncLink = { baseId: 'app123' };
    const result = parse(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('syncLink');
    }
  });

  it('never throws on malformed input', () => {
    const malformedInputs = [
      '',
      '{',
      '}',
      'null',
      '[]',
      'undefined',
      '\x00\x01\x02',
      '{"formatVersion":1,"tableId":"t","name":"n","fields":"not-array","rows":[],"views":[],"syncLink":null}',
    ];
    for (const input of malformedInputs) {
      expect(() => parse(input)).not.toThrow();
      const result = parse(input);
      expect(result.ok).toBe(false);
    }
  });
});

describe('Round-trip: serialize → parse → serialize', () => {
  it('all valid samples round-trip byte-identical', () => {
    const samples = ['empty.tablify', 'typical.tablify', 'edge.tablify'];
    for (const file of samples) {
      const original = readFileSync(join(SAMPLES_DIR, 'v1', file), 'utf-8');
      const parsed = parse(original);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const reserialized = serialize(parsed.data);
        expect(reserialized).toBe(original);
      }
    }
  });
});
