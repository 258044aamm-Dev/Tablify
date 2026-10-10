import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

describe('tablify.schema.json validation', () => {
  let ajv: InstanceType<typeof Ajv2020>;
  let validate: ReturnType<InstanceType<typeof Ajv2020>['compile']>;
  let schema: object;

  beforeAll(() => {
    schema = JSON.parse(readFileSync(join(process.cwd(), 'tablify.schema.json'), 'utf-8'));
    ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validate = ajv.compile(schema);
  });

  describe('valid samples (samples/v2/, P8-03)', () => {
    it('accepts formula-link.tablify (formula and link fields, formatVersion 2)', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v2', 'formula-link.tablify'), 'utf-8')
      );
      expect(data.formatVersion).toBe(2);
      const valid = validate(data);
      if (!valid) console.error('Validation errors:', validate.errors);
      expect(valid).toBe(true);
    });
  });

  describe('valid samples (samples/v1/)', () => {
    const validFiles = ['empty.tablify', 'typical.tablify', 'edge.tablify', 'synced.tablify'];

    for (const file of validFiles) {
      it(`accepts ${file}`, () => {
        const data = JSON.parse(
          readFileSync(join(process.cwd(), 'samples', 'v1', file), 'utf-8')
        );
        const valid = validate(data);
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });
    }
  });

  describe('invalid samples (samples/invalid/)', () => {
    it('rejects wrong-type.tablify (rev is string instead of integer)', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'invalid', 'wrong-type.tablify'), 'utf-8')
      );
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail because rev must be an integer
      const hasTypeError = validate.errors!.some(
        (e: any) => e.keyword === 'type' && e.instancePath.includes('rev')
      );
      expect(hasTypeError).toBe(true);
    });

    it('rejects missing-format-version.tablify (no formatVersion key)', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'invalid', 'missing-format-version.tablify'), 'utf-8')
      );
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail because formatVersion is required
      const hasRequired = validate.errors!.some(
        (e: any) => e.keyword === 'required' && e.params.missingProperty === 'formatVersion'
      );
      expect(hasRequired).toBe(true);
    });

    it('rejects duplicate-field-id.tablify (schema allows it but semantic check needed)', () => {
      // Note: JSON Schema alone cannot enforce unique field IDs across an array.
      // This test verifies the schema at least accepts the structure;
      // semantic uniqueness is enforced by the application logic (P1-02).
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'invalid', 'duplicate-field-id.tablify'), 'utf-8')
      );
      // The schema validates syntactically (it passes structure checks).
      // Semantic uniqueness of field IDs is an application-level check.
      // We verify the file is structurally valid JSON and has the right shape.
      const valid = validate(data);
      // Schema-level: this passes structurally (duplicates are semantic errors)
      expect(valid).toBe(true);

      // Application-level semantic check: detect duplicate field IDs
      const fieldIds = data.fields.map((f: any) => f.id);
      const uniqueIds = new Set(fieldIds);
      expect(uniqueIds.size).toBeLessThan(fieldIds.length);
    });

    it('rejects unknown-row-field.tablify (row references non-existent field)', () => {
      // Similar to duplicate-field-id: schema allows additionalProperties in values,
      // but semantic checks enforce that row value keys match declared field IDs.
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'invalid', 'unknown-row-field.tablify'), 'utf-8')
      );
      // Schema-level: passes (additionalProperties: true in values)
      const valid = validate(data);
      expect(valid).toBe(true);

      // Application-level semantic check: row values reference unknown field
      const fieldIds = new Set(data.fields.map((f: any) => f.id));
      let foundUnknownField = false;
      for (const row of data.rows) {
        for (const key of Object.keys(row.values)) {
          if (!fieldIds.has(key)) {
            foundUnknownField = true;
          }
        }
      }
      expect(foundUnknownField).toBe(true);
    });
  });

  describe('formatVersion enforcement', () => {
    it('rejects formatVersion other than 1 or 2', () => {
      const data = {
        formatVersion: 3,
        tableId: 'tbl_TEST',
        name: 'Test',
        fields: [{ id: 'fld_name', name: 'Name', type: 'text', primary: true }],
        rows: [],
        views: [{
          id: 'view_default', name: 'Default', sort: [], groupBy: null,
          hidden: [], frozenColumns: 1, rowHeight: 'medium', columnWidths: {}
        }],
        syncLink: null
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('accepts formatVersion exactly 1', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'empty.tablify'), 'utf-8')
      );
      expect(data.formatVersion).toBe(1);
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('syncLink and sync (P7-04): valid structures accepted, malformed rejected', () => {
    it('rejects a syncLink that is missing required keys', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'empty.tablify'), 'utf-8')
      );
      data.syncLink = { baseId: 'app123' };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('rejects a row sync block that is missing required keys', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'typical.tablify'), 'utf-8')
      );
      data.rows[0].sync = { airtableId: 'rec123' };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('sync structures (P7-04)', () => {
    it('rejects samples/invalid/bad-sync.tablify (bad record ID, hash, and base ID)', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'invalid', 'bad-sync.tablify'), 'utf-8')
      );
      expect(validate(data)).toBe(false);
    });

    it('accepts a fully valid syncLink and row sync block', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'synced.tablify'), 'utf-8')
      );
      expect(validate(data)).toBe(true);
    });

    it('rejects a row sync block with a non-hex remoteHash', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'synced.tablify'), 'utf-8')
      );
      data.rows[0].sync.remoteHash = 'not-a-hash';
      expect(validate(data)).toBe(false);
    });
  });

  describe('field type enum', () => {
    it('accepts all 19 valid field types', () => {
      const types = [
        'text', 'long_text', 'number', 'currency', 'percent',
        'duration', 'rating', 'checkbox', 'date', 'date_time',
        'url', 'email', 'phone',
        'single_select', 'multi_select', 'attachment',
        'auto_number', 'created_time', 'modified_time'
      ];
      for (const type of types) {
        const data = {
          formatVersion: 1,
          tableId: 'tbl_TEST',
          name: 'Test',
          fields: [{ id: 'fld_test', name: 'Test', type, primary: true }],
          rows: [],
          views: [{
            id: 'view_default', name: 'Default', sort: [], groupBy: null,
            hidden: [], frozenColumns: 1, rowHeight: 'medium', columnWidths: {}
          }],
          syncLink: null
        };
        const valid = validate(data);
        expect(valid).toBe(true);
      }
    });

    it('rejects invalid field type', () => {
      const data = {
        formatVersion: 1,
        tableId: 'tbl_TEST',
        name: 'Test',
        fields: [{ id: 'fld_test', name: 'Test', type: 'invalid_type', primary: true }],
        rows: [],
        views: [{
          id: 'view_default', name: 'Default', sort: [], groupBy: null,
          hidden: [], frozenColumns: 1, rowHeight: 'medium', columnWidths: {}
        }],
        syncLink: null
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('unknown key preservation', () => {
    it('validates successfully with unknown top-level key', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'v1', 'edge.tablify'), 'utf-8')
      );
      expect(data.unknownTopLevel).toBeDefined();
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });
});

describe('tablify.schema.json — persisted search and query (SAD-69)', () => {
  const schemaObj = JSON.parse(readFileSync(join(process.cwd(), 'tablify.schema.json'), 'utf-8'));
  const ajv2 = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv2);
  const validate = ajv2.compile(schemaObj);

  function withView(extra: Record<string, unknown>) {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'samples', 'v1', 'empty.tablify'), 'utf-8'));
    Object.assign(data.views[0], extra);
    return data;
  }

  it('accepts a view carrying search and query', () => {
    const valid = validate(withView({ search: 'alpha', query: 'Status:done' }));
    if (!valid) console.error('Validation errors:', validate.errors);
    expect(valid).toBe(true);
  });

  it('accepts an explicit null query (means no filter)', () => {
    expect(validate(withView({ query: null }))).toBe(true);
  });

  it('accepts an empty search string', () => {
    expect(validate(withView({ search: '' }))).toBe(true);
  });

  it('rejects a non-string search', () => {
    expect(validate(withView({ search: 42 }))).toBe(false);
  });

  it('rejects a non-string, non-null query', () => {
    expect(validate(withView({ query: 7 }))).toBe(false);
  });
});
