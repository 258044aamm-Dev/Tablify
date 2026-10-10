// P7-01 — parse the body of a ```tablify fence (v1.1). Pure, no Obsidian imports.
//
// The body is the vault-relative path of a .tablify file. An optional `view: grid` line is
// allowed (the prototype's fence shows it). Anything else is rejected with a clear message.

export type EmbedSourceResult = { ok: true; path: string } | { ok: false; error: string };

const MAX_PATH_LENGTH = 512;
const EXT = '.tablify';

export function parseEmbedSource(body: string): EmbedSourceResult {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { ok: false, error: 'Tablify embed: add the path of a .tablify file inside the code block.' };
  }

  let path: string | null = null;
  for (const line of lines) {
    if (/^view\s*:/i.test(line)) {
      const value = line.replace(/^view\s*:/i, '').trim().toLowerCase();
      if (value !== 'grid') {
        return { ok: false, error: `Tablify embed: view "${value}" is not supported. Use "view: grid".` };
      }
      continue;
    }
    if (path !== null) {
      return { ok: false, error: 'Tablify embed: the code block must contain one file path.' };
    }
    path = line;
  }
  if (path === null) {
    return { ok: false, error: 'Tablify embed: add the path of a .tablify file inside the code block.' };
  }
  return validatePath(path);
}

function hasControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

/** Validates a vault-relative .tablify path. Other extensions and paths outside the vault are refused. */
export function validatePath(path: string): EmbedSourceResult {
  if (path.length > MAX_PATH_LENGTH) {
    return { ok: false, error: 'Tablify embed: the file path is too long.' };
  }
  if (hasControlChars(path)) {
    return { ok: false, error: 'Tablify embed: the file path contains control characters.' };
  }
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path) || path.includes('\\')) {
    return { ok: false, error: 'Tablify embed: use a vault-relative path with forward slashes.' };
  }
  const segments = path.split('/');
  if (segments.some((s) => s === '..' || s === '.' || s === '')) {
    return { ok: false, error: 'Tablify embed: the file path must stay inside the vault.' };
  }
  if (!path.toLowerCase().endsWith(EXT)) {
    return { ok: false, error: `Tablify embed: only ${EXT} files can be embedded.` };
  }
  return { ok: true, path };
}
