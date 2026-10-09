// T-F (guidelines §0.2): 10,000 seeded malformed inputs. No uncaught exception,
// errors carry a position, and streaming equals whole-string parsing.
import { describe, it, expect } from 'vitest';
import { parseCsv, CsvStreamParser } from '../../src/io/csv.js';
import { mulberry32, pick, randInt } from './rng.js';

const ALPHABET = ['"', '"', '"', ',', ';', '\n', '\r', 'a', 'b', ' ', '\uFEFF', 'é', '\0', '\t'];

describe('CSV fuzz — malformed input (P4-01 T-F)', () => {
  it('never throws and always reports a position on error (10,000 cases)', () => {
    let errors = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const rand = mulberry32(seed * 7919);
      const len = randInt(rand, 0, 200);
      let input = '';
      for (let i = 0; i < len; i++) input += pick(rand, ALPHABET);

      let result: ReturnType<typeof parseCsv>;
      try {
        result = parseCsv(input);
      } catch (e) {
        throw new Error(`seed ${seed} threw: ${String(e)}`, { cause: e });
      }
      if (result.ok) {
        for (const row of result.rows) expect(Array.isArray(row)).toBe(true);
      } else {
        errors++;
        expect(typeof result.error).toBe('string');
        expect(result.line).toBeGreaterThanOrEqual(1);
        expect(result.column).toBeGreaterThanOrEqual(1);
      }

      // Streaming with random chunk boundaries must agree with whole-string parsing.
      const rows: string[][] = [];
      const p = new CsvStreamParser({ onRow: (r) => rows.push(r) });
      let pos = 0;
      while (pos < input.length) {
        const n = randInt(rand, 1, 17);
        p.push(input.slice(pos, pos + n));
        pos += n;
      }
      const streamed = p.end();
      expect(streamed.ok).toBe(result.ok);
      if (result.ok) expect(rows).toEqual(result.rows);
    }
    // Sanity: the generator really produces malformed input.
    expect(errors).toBeGreaterThan(1000);
  });
});
