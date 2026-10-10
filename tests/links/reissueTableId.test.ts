import { describe, expect, it } from 'vitest';
import { decideReissue, reissueTableIdText } from '../../src/links/reissueTableId.js';
import { parse } from '../../src/format/parse.js';
import { newTableText } from '../../src/menus/fileMenuModel.js';

describe('reissueTableIdText', () => {
  it('changes only tableId; all other keys are kept', () => {
    const original = newTableText('Customers');
    const before = parse(original);
    expect(before.ok).toBe(true);
    const result = reissueTableIdText(original);
    expect(result.ok).toBe(true);
    if (!result.ok || !before.ok) return;
    const after = parse(result.text);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.tableId).not.toBe(before.data.tableId);
    expect(after.data.tableId.length).toBeGreaterThan(0);
    expect({ ...after.data, tableId: '' }).toEqual({ ...before.data, tableId: '' });
  });

  it('reports a parse error and leaves the caller to skip the write', () => {
    const result = reissueTableIdText('not a table file');
    expect(result.ok).toBe(false);
  });
});

describe('decideReissue', () => {
  const dup = [{ tableId: 'T1', paths: ['A.tablify', 'Copy of A.tablify'] }];

  it('a file that is not in any duplicate group is not-duplicated', () => {
    expect(decideReissue(dup, 'Other.tablify', [])).toEqual({ kind: 'not-duplicated' });
    expect(decideReissue([], 'A.tablify', [])).toEqual({ kind: 'not-duplicated' });
  });

  it('the owner (first path) keeps its ID', () => {
    expect(decideReissue(dup, 'A.tablify', [])).toEqual({ kind: 'keeps-id' });
  });

  it('a copy open in a table tab is refused', () => {
    expect(decideReissue(dup, 'Copy of A.tablify', ['Copy of A.tablify'])).toEqual({ kind: 'open' });
  });

  it('a closed copy gets a new ID', () => {
    expect(decideReissue(dup, 'Copy of A.tablify', ['A.tablify'])).toEqual({ kind: 'reissue' });
  });

  it('three files: each copy after the owner is reissued, the owner is kept', () => {
    const three = [{ tableId: 'T1', paths: ['A.tablify', 'B.tablify', 'C.tablify'] }];
    expect(decideReissue(three, 'B.tablify', [])).toEqual({ kind: 'reissue' });
    expect(decideReissue(three, 'C.tablify', [])).toEqual({ kind: 'reissue' });
    expect(decideReissue(three, 'A.tablify', [])).toEqual({ kind: 'keeps-id' });
  });
});
