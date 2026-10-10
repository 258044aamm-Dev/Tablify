// S0 smoke: render the frozen prototype in one theme/viewport and save a screenshot.
// Usage: npx tsx tests/visual/capture-reference.ts [light|dark] [desktop|mobile] [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer } from './lib/server';
import { openSession, type Theme, type ViewportName } from './lib/capture';

const REPO = path.resolve(__dirname, '..', '..');

async function main() {
  const theme = (process.argv[2] ?? 'dark') as Theme;
  const viewport = (process.argv[3] ?? 'desktop') as ViewportName;
  const outDir = path.resolve(process.argv[4] ?? path.join(REPO, 'docs/evidence/visual-parity/tmp'));
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(REPO);
  const session = await openSession(server.origin, theme, viewport, '/Prototype/index.html');
  try {
    await session.page.waitForTimeout(500);
    const out = path.join(outDir, `reference-${theme}-${viewport}.png`);
    await session.page.screenshot({ path: out });
    console.log(JSON.stringify({ out, served: session.routes.served.length, blocked: session.routes.blocked }, null, 2));
  } finally {
    await session.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
