// Network policy for the visual-parity harness.
// The prototype loads Tailwind, Font Awesome and Google Fonts from CDNs. For a
// deterministic baseline, every CDN request is answered from a pinned local copy.
// Any other external request is aborted and recorded: the production harness must
// make zero external requests (plan §2 criterion 4).
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Route } from 'playwright';

const REPO = path.resolve(__dirname, '..', '..', '..');
const TAILWIND = path.join(REPO, 'tests/visual/vendor/tailwind-play-cdn.js');
const FA_ROOT = path.join(REPO, 'node_modules/@fortawesome/fontawesome-free');
const FONTSOURCE = path.join(REPO, 'node_modules/@fontsource');

// Google Fonts weights requested by Prototype/index.html (line 15).
const GOOGLE_FACES: Array<{ pkg: string; weight: number; style: 'normal' | 'italic' }> = [
  ...[400, 500, 600, 700].map((w) => ({ pkg: 'poppins', weight: w, style: 'normal' as const })),
  ...[400, 500, 600].map((w) => ({ pkg: 'lora', weight: w, style: 'normal' as const })),
  { pkg: 'lora', weight: 400, style: 'italic' },
  ...[400, 500].map((w) => ({ pkg: 'jetbrains-mono', weight: w, style: 'normal' as const })),
];

const LOCAL_FONT_HOST = 'fonts.gstatic.com';

function googleCss(): string {
  // Fontsource ships one @font-face block per subset. Only the latin block is
  // used, for both pages, so the baseline and production load identical files.
  return GOOGLE_FACES.map((f) => {
    const file = `${f.weight}${f.style === 'italic' ? '-italic' : ''}.css`;
    const css = fs.readFileSync(path.join(FONTSOURCE, f.pkg, file), 'utf8');
    const header = `/* ${f.pkg}-latin-${f.weight}-${f.style} */`;
    const start = css.indexOf(header);
    if (start < 0) throw new Error(`missing latin block ${header} in ${file}`);
    const end = css.indexOf('}', start) + 1;
    const block = css.slice(start, end);
    return block.replace(/url\(\.\/files\/([^)]+)\)/g, `url(https://${LOCAL_FONT_HOST}/fontsource/${f.pkg}/$1)`);
  }).join('\n');
}

export interface RouteLog {
  blocked: string[];
  served: string[];
}

function fulfillFile(route: Route, file: string, type: string, log: RouteLog) {
  if (!fs.existsSync(file)) {
    log.blocked.push(`missing-local:${route.request().url()}`);
    return route.fulfill({ status: 404, body: 'missing' });
  }
  log.served.push(route.request().url());
  return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
}

export async function installCdnRoutes(context: BrowserContext): Promise<RouteLog> {
  const log: RouteLog = { blocked: [], served: [] };
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const host = url.hostname;
    const p = url.pathname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();

    if (host === 'cdn.tailwindcss.com') return fulfillFile(route, TAILWIND, 'text/javascript', log);

    if (host === 'cdnjs.cloudflare.com' && p === '/ajax/libs/font-awesome/6.4.0/css/all.min.css') {
      return fulfillFile(route, path.join(FA_ROOT, 'css/all.min.css'), 'text/css', log);
    }
    if (host === 'cdnjs.cloudflare.com' && p.startsWith('/ajax/libs/font-awesome/6.4.0/webfonts/')) {
      const name = path.basename(p);
      return fulfillFile(route, path.join(FA_ROOT, 'webfonts', name), 'font/woff2', log);
    }

    if (host === 'fonts.googleapis.com' && p === '/css2') {
      log.served.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/css', body: googleCss() });
    }
    if (host === LOCAL_FONT_HOST && p.startsWith('/fontsource/')) {
      const rel = p.replace('/fontsource/', '');
      const file = path.join(FONTSOURCE, rel.split('/')[0], 'files', rel.split('/').slice(1).join('/'));
      return fulfillFile(route, file, 'font/woff2', log);
    }

    log.blocked.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  return log;
}
