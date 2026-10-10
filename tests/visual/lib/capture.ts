// Shared capture helper: one browser context per (target, theme, viewport).
// Both targets get identical settings so the pixel comparison is like-for-like.
import { chromium, type Browser, type Page } from 'playwright';
import { installCdnRoutes, type RouteLog } from './routes';

export type Theme = 'light' | 'dark';
export type ViewportName = 'desktop' | 'mobile';
export const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1400, height: 900 },
  mobile: { width: 390, height: 844 },
};

// Animations, transitions and caret are switched off so frames are stable.
export const STABLE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

export interface Session {
  browser: Browser;
  page: Page;
  routes: RouteLog;
  close(): Promise<void>;
}

export async function openSession(origin: string, theme: Theme, viewport: ViewportName, url: string): Promise<Session> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const routes = await installCdnRoutes(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-10T06:00:00Z'));
  await page.goto(origin + url, { waitUntil: 'load' });
  await page.addStyleTag({ content: STABLE_CSS });
  await page.evaluate(() => document.fonts.ready);
  return {
    browser,
    page,
    routes,
    close: () => browser.close(),
  };
}
