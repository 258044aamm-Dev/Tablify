// RFC 4180 CSV parser with streaming (chunked) input — no Obsidian or Node imports.
// Step P4-01 (SAD-36). Spec: spec/steps/P4-01.md, spec/guidelines.md P4-01.
//
// Rules (recorded for evidence):
//  - Fields may be quoted with "..."; a doubled "" inside a quoted field is one ".
//  - Quoted fields may contain delimiters, CR, and LF.
//  - Record ends: LF, CRLF, or a lone CR (outside quotes).
//  - A UTF-8 BOM at the very start of the input is removed.
//  - Delimiter is ',' or ';', detected on the first record: the character that occurs
//    more often outside quotes wins; a tie (including zero of both) selects ','.
//  - Lenient: a '"' inside an unquoted field is kept literally.
//  - Strict: text after a closing quote (other than a delimiter or newline) is an error.
//  - Strict: an unterminated quoted field at end of input is an error.
//  - Ragged rows (different column counts) are returned as-is; the caller decides.
//  - Never throws. Malformed input yields { ok: false, error, line, column }.
//  - Empty input yields zero rows. A trailing newline does not create an empty row.

export type CsvDelimiter = ',' | ';';

export interface CsvParseOptions {
  /** Force a delimiter instead of detecting it. */
  delimiter?: CsvDelimiter;
}

export type CsvParseResult =
  | { ok: true; delimiter: CsvDelimiter; rows: string[][]; hadBom: boolean }
  | { ok: false; error: string; line: number; column: number };

export interface CsvStreamOptions extends CsvParseOptions {
  /** Called once per record, in order. */
  onRow: (row: string[]) => void;
}

export type CsvStreamResult =
  | { ok: true; delimiter: CsvDelimiter; hadBom: boolean; rowCount: number }
  | { ok: false; error: string; line: number; column: number; rowCount: number };

/** Default chunk size used by parseCsv when it feeds the streaming parser. */
export const CSV_CHUNK_SIZE = 64 * 1024;

type State = 'FIELD_START' | 'UNQUOTED' | 'QUOTED' | 'QUOTE_SEEN';

/**
 * Streaming CSV parser. Feed text with push(), then call end().
 * Memory use is bounded by the longest record, not by the input size.
 */
export class CsvStreamParser {
  private readonly onRow: (row: string[]) => void;
  private delimiter: CsvDelimiter | null;
  private hadBom = false;
  private started = false;

  // Delimiter detection buffer (used until the first record is complete).
  private head = '';
  private headScanIdx = 0;
  private headInQuote = false;
  private headDone = false;
  private headCommas = 0;
  private headSemis = 0;

  // Record state machine.
  private state: State = 'FIELD_START';
  private row: string[] = [];
  private field = '';
  private skipLF = false;
  private line = 1;
  private column = 1;
  private rowCount = 0;
  private failure: { error: string; line: number; column: number } | null = null;

  constructor(options: CsvStreamOptions) {
    this.onRow = options.onRow;
    this.delimiter = options.delimiter ?? null;
  }

  push(chunk: string): void {
    if (this.failure || chunk.length === 0) return;
    if (!this.started) {
      this.started = true;
      if (chunk.charCodeAt(0) === 0xfeff) {
        this.hadBom = true;
        chunk = chunk.slice(1);
      }
    }
    if (this.delimiter === null) {
      this.head += chunk;
      this.scanHead();
      if (!this.headDone) return;
      this.delimiter = this.decideDelimiter();
      // Feed everything buffered so far, then clear the buffer.
      const buffered = this.head;
      this.head = '';
      this.feed(buffered);
      return;
    }
    this.feed(chunk);
  }

  end(): CsvStreamResult {
    if (this.failure) return this.failureResult();
    if (this.delimiter === null) {
      // Input ended before the first record finished: decide now.
      this.delimiter = this.decideDelimiter();
      const buffered = this.head;
      this.head = '';
      this.feed(buffered);
      if (this.failure) return this.failureResult();
    }
    if (this.state === 'QUOTED') {
      return this.fail('Unterminated quoted field at end of input');
    }
    if (this.state === 'QUOTE_SEEN' || this.row.length > 0 || this.field.length > 0 || this.state !== 'FIELD_START') {
      this.pushField();
      this.emitRow();
    }
    return { ok: true, delimiter: this.delimiter, hadBom: this.hadBom, rowCount: this.rowCount };
  }

  // ---- delimiter detection -------------------------------------------------

  /** Scan the buffered head until the first record ends (unquoted newline). */
  private scanHead(): void {
    const s = this.head;
    let i = this.headScanIdx;
    while (i < s.length) {
      const c = s.charCodeAt(i);
      if (c === 0x22) {
        this.headInQuote = !this.headInQuote;
      } else if (!this.headInQuote) {
        if (c === 0x0a || c === 0x0d) {
          this.headDone = true;
          break;
        }
        if (c === 0x2c) this.headCommas++;
        else if (c === 0x3b) this.headSemis++;
      }
      i++;
    }
    this.headScanIdx = i;
  }

  private decideDelimiter(): CsvDelimiter {
    return this.headSemis > this.headCommas ? ';' : ',';
  }

  // ---- record state machine ------------------------------------------------

  private feed(text: string): void {
    const delim = this.delimiter as CsvDelimiter;
    const delimCode = delim.charCodeAt(0);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);

      if (this.skipLF) {
        this.skipLF = false;
        if (c === 0x0a) {
          this.advance(c);
          continue;
        }
      }

      switch (this.state) {
        case 'FIELD_START':
          if (c === 0x22) {
            this.state = 'QUOTED';
          } else if (c === delimCode) {
            this.pushField();
          } else if (c === 0x0a || c === 0x0d) {
            this.endRecord(c);
          } else {
            this.field = text[i];
            this.state = 'UNQUOTED';
          }
          break;

        case 'UNQUOTED':
          if (c === delimCode) {
            this.pushField();
            this.state = 'FIELD_START';
          } else if (c === 0x0a || c === 0x0d) {
            this.endRecord(c);
            this.state = 'FIELD_START';
          } else {
            this.field += text[i];
          }
          break;

        case 'QUOTED':
          if (c === 0x22) {
            this.state = 'QUOTE_SEEN';
          } else {
            this.field += text[i];
          }
          break;

        case 'QUOTE_SEEN':
          if (c === 0x22) {
            this.field += '"';
            this.state = 'QUOTED';
          } else if (c === delimCode) {
            this.pushField();
            this.state = 'FIELD_START';
          } else if (c === 0x0a || c === 0x0d) {
            this.endRecord(c);
            this.state = 'FIELD_START';
          } else {
            this.fail(`Unexpected character after closing quote: "${text[i]}"`);
            return;
          }
          break;
      }
      this.advance(c);
      if (this.failure) return;
    }
  }

  private advance(c: number): void {
    if (c === 0x0a || c === 0x0d) {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }

  private pushField(): void {
    this.row.push(this.field);
    this.field = '';
  }

  private endRecord(c: number): void {
    this.pushField();
    this.emitRow();
    if (c === 0x0d) this.skipLF = true;
  }

  private emitRow(): void {
    const row = this.row;
    this.row = [];
    this.rowCount++;
    this.onRow(row);
  }

  private fail(error: string): CsvStreamResult {
    this.failure = { error, line: this.line, column: this.column };
    return this.failureResult();
  }

  private failureResult(): CsvStreamResult {
    const f = this.failure as { error: string; line: number; column: number };
    return { ok: false, error: f.error, line: f.line, column: f.column, rowCount: this.rowCount };
  }
}

/**
 * Parse a full CSV string. Internally uses the streaming parser, fed in
 * CSV_CHUNK_SIZE slices, so both paths share one implementation.
 */
export function parseCsv(input: string, options: CsvParseOptions = {}): CsvParseResult {
  const rows: string[][] = [];
  const parser = new CsvStreamParser({ ...options, onRow: (r) => rows.push(r) });
  for (let pos = 0; pos < input.length; pos += CSV_CHUNK_SIZE) {
    parser.push(input.slice(pos, pos + CSV_CHUNK_SIZE));
  }
  const res = parser.end();
  if (!res.ok) return { ok: false, error: res.error, line: res.line, column: res.column };
  return { ok: true, delimiter: res.delimiter, rows, hadBom: res.hadBom };
}

/** Detect ',' or ';' from the first record of a text. Returns ',' on a tie. */
export function detectDelimiter(text: string): CsvDelimiter {
  let commas = 0;
  let semis = 0;
  let inQuote = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) inQuote = !inQuote;
    else if (!inQuote) {
      if (c === 0x0a || c === 0x0d) break;
      if (c === 0x2c) commas++;
      else if (c === 0x3b) semis++;
    }
  }
  return semis > commas ? ';' : ',';
}
