// Deterministic ID generation using crypto.getRandomValues().
// IDs use prefixes and at least 80 bits of randomness (G-A6).

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomId(prefix: string, length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

export function generateRowId(): string {
  return randomId('row_');
}

export function generateFieldId(): string {
  return randomId('fld_');
}

export function generateOptionId(): string {
  return randomId('opt_');
}

export function generateTableId(): string {
  return randomId('tbl_');
}

export function generateViewId(): string {
  return randomId('view_');
}
