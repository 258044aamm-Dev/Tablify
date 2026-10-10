// P7-03 — token redaction (second line of defense).
//
// The Airtable client already keeps the token out of its messages. This helper is for any
// text that could still carry a secret (for example a message built from outside input).
// It removes the exact secret, any "Bearer <value>" header, and anything shaped like an
// Airtable personal access token.

export const REDACTED = '[token hidden]';

/** Airtable personal access tokens look like pat<14 chars>.<64 hex>. */
const AIRTABLE_PAT_SHAPE = /pat[A-Za-z0-9]{14}\.[0-9a-fA-F]{64}/g;
/** Non-global copy for yes/no tests. A global regex keeps state between .test() calls. */
const PAT_SHAPE_ONCE = /pat[A-Za-z0-9]{14}\.[0-9a-fA-F]{64}/;
const BEARER_SHAPE = /Bearer\s+[^\s"',;]+/gi;
/** Shorter secrets are not used as a literal match, so common words are not replaced. */
const MIN_LITERAL_SECRET_LENGTH = 8;

export function redactSecrets(text: string, secret?: string): string {
  let out = text;
  if (secret && secret.length >= MIN_LITERAL_SECRET_LENGTH) {
    out = out.split(secret).join(REDACTED);
  }
  out = out.replace(BEARER_SHAPE, 'Bearer ' + REDACTED);
  out = out.replace(AIRTABLE_PAT_SHAPE, REDACTED);
  return out;
}

/** True when `text` still contains the secret or a token-shaped value after redaction. */
export function containsSecret(text: string, secret?: string): boolean {
  if (secret && secret.length >= MIN_LITERAL_SECRET_LENGTH && text.includes(secret)) return true;
  return /Bearer\s+(?!\[token hidden\])/i.test(text) || PAT_SHAPE_ONCE.test(text);
}
