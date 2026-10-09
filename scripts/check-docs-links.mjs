#!/usr/bin/env node
// P6-05 — Link check for Tablify documentation (spec action 4).
// Validates that every RELATIVE markdown link in README.md, CHANGELOG.md and
// docs/**/*.md resolves to an existing file in this repository. External
// (http/https) links are only syntax-checked, not fetched — deterministic and
// network-free so CI results never flap.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

const ROOT = resolve(join(dirname(new URL(import.meta.url).pathname), '..'));
const errors = [];

function collectMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...collectMarkdown(p));
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = [join(ROOT, 'README.md'), join(ROOT, 'CHANGELOG.md'), ...collectMarkdown(join(ROOT, 'docs'))];

// [text](target) — skips images inside  (handled the same way), skips anchors-only links.
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = file.slice(ROOT.length + 1);
  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    if (target.startsWith('#')) continue; // in-page anchor
    if (/^https?:\/\//i.test(target)) {
      if (!/^https?:\/\/[^\s)]+$/.test(target)) errors.push(`${rel}: malformed external link ${target}`);
      continue;
    }
    if (/^mailto:/i.test(target)) continue;
    const [pathPart, anchor] = target.split('#');
    const resolved = resolve(dirname(file), pathPart);
    let ok = true;
    try {
      statSync(resolved);
    } catch {
      ok = false;
    }
    if (!resolved.startsWith(ROOT + sep) && resolved !== ROOT) {
      errors.push(`${rel}: link escapes the repository — ${target}`);
      ok = false;
    }
    if (!ok) {
      errors.push(`${rel}: broken relative link → ${target}`);
      continue;
    }
    if (anchor && statSync(resolved).isFile()) {
      // anchor presence is not validated (GitHub-style slugging varies); count only
    }
  }
}

const checked = files.length;
if (errors.length) {
  console.error(`Link check FAILED (${errors.length} problem(s) in ${checked} files):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`Link check PASS — ${checked} markdown files, all relative links resolve.`);
