// Pure SHA-256 and canonical JSON (P7-08). No Node or DOM crypto, so it runs the same in Obsidian
// desktop, Obsidian mobile, and the test environments.
//
// The round constants and initial hash values are not typed in by hand. They are the first 32 bits
// of the fractional parts of the cube roots (K) and square roots (H0) of the first primes, computed
// here with exact BigInt integer roots. Test vectors in tests/sync/hash.test.ts confirm the output.

function integerRoot(n: bigint, degree: 2 | 3): bigint {
  // Floor of the degree-th root of n, by Newton iteration on BigInt.
  if (n < 2n) return n;
  const d = BigInt(degree);
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / degree) + 1);
  for (;;) {
    const next = ((d - 1n) * x + n / x ** (d - 1n)) / d;
    if (next >= x) return x;
    x = next;
  }
}

function firstPrimes(count: number): number[] {
  const out: number[] = [];
  for (let n = 2; out.length < count; n++) {
    if (out.every((p) => n % p !== 0)) out.push(n);
  }
  return out;
}

const MASK32 = 0xffffffffn;
const K: readonly number[] = firstPrimes(64).map((p) => Number((integerRoot(BigInt(p) << 96n, 3) & MASK32)));
const H0: readonly number[] = firstPrimes(8).map((p) => Number((integerRoot(BigInt(p) << 64n, 2) & MASK32)));

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 of the UTF-8 bytes of `text`, as 64 lowercase hex characters. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = BigInt(bytes.length) * 8n;
  const paddedLen = ((bytes.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Number(bitLen >> 32n));
  view.setUint32(paddedLen - 4, Number(bitLen & MASK32));

  const H = H0.slice();
  const W = new Uint32Array(64);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const working = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) H[i] = (H[i] + working[i]) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** JSON with object keys sorted at every level, so equal data always gives equal text. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
  return JSON.stringify(value);
}
