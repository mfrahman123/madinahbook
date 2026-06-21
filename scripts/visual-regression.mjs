import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { paidTestUser, testUser, startTestServer } from "../tests/helpers/test-server.mjs";

const artifactDir = path.resolve("test-artifacts", "visual");

async function main() {
  await fs.mkdir(artifactDir, { recursive: true });
  const server = await startTestServer();
  let browser;

  try {
    const launchOptions = { headless: true };
    if (process.env.PLAYWRIGHT_CHANNEL) launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
    browser = await chromium.launch(launchOptions);
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await capture(desktop, server.baseUrl, "public-home-desktop");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await capture(mobile, server.baseUrl, "public-home-mobile", { viewportOnly: true });

    const freePage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(freePage, server.baseUrl, testUser);
    await gotoRoute(freePage, server.baseUrl, "?route=book-2", "text=Upgrade to Premium");
    await freePage.waitForSelector("text=Upgrade to Premium");
    await capture(freePage, server.baseUrl, "free-upgrade-gate");

    const paidPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(paidPage, server.baseUrl, paidTestUser);
    await capture(paidPage, server.baseUrl, "premium-dashboard-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=books", ".books-page");
    await capture(paidPage, server.baseUrl, "premium-books-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=book-2", "text=إِنَّ, لَعَلَّ, ذُو and Large Numbers");
    await paidPage.waitForSelector("text=إِنَّ, لَعَلَّ, ذُو and Large Numbers");
    await capture(paidPage, server.baseUrl, "premium-book-2");
    await gotoRoute(paidPage, server.baseUrl, "?route=vocabulary", ".vocabulary-tabs");
    await capture(paidPage, server.baseUrl, "premium-vocabulary-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=vocabulary&vocabTab=tester", ".vocab-tester-card");
    await capture(paidPage, server.baseUrl, "premium-vocab-tester-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=vocabulary&theme=light", ".vocabulary-tabs");
    await capture(paidPage, server.baseUrl, "light-premium-vocabulary-desktop");
    await assertLightSelectionPalette(paidPage, "light premium vocabulary");
    await gotoRoute(paidPage, server.baseUrl, "?route=vocabulary&vocabTab=tester&theme=light", ".vocab-tester-card");
    await capture(paidPage, server.baseUrl, "light-premium-vocab-tester-desktop");
    await assertLightSelectionPalette(paidPage, "light premium vocabulary tester");
    await gotoRoute(paidPage, server.baseUrl, "?route=book-1&lesson=lesson-5&tab=quiz", ".cumulative-card");
    await capture(paidPage, server.baseUrl, "premium-lesson-5-quiz-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=subscription", ".subscription-hero");
    await capture(paidPage, server.baseUrl, "premium-subscription-desktop");
    await gotoRoute(paidPage, server.baseUrl, "?route=account", ".account-hero");
    await capture(paidPage, server.baseUrl, "premium-account-desktop");

    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(adminPage, server.baseUrl, paidTestUser);
    await adminPage.locator('.sidebar [data-route="admin"]').click();
    await adminPage.waitForSelector("text=Content Management");
    await capture(adminPage, server.baseUrl, "admin-content");

    const mobilePaidPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
    await login(mobilePaidPage, server.baseUrl, paidTestUser);
    await capture(mobilePaidPage, server.baseUrl, "mobile-dashboard", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=book-1&lesson=lesson-1", ".lesson-reader");
    await capture(mobilePaidPage, server.baseUrl, "mobile-book-1-learn", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=book-1&lesson=lesson-1&tab=book-exercises", ".book-exercise-panel");
    await capture(mobilePaidPage, server.baseUrl, "mobile-book-1-exercises", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=vocabulary", ".vocabulary-tabs");
    await capture(mobilePaidPage, server.baseUrl, "mobile-vocabulary", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=vocabulary&vocabTab=tester", ".vocab-tester-card");
    await capture(mobilePaidPage, server.baseUrl, "mobile-vocab-tester", { mobileShell: true, viewportOnly: true });
    await mobilePaidPage.locator("[data-vocab-tester-filters-toggle]").click();
    await mobilePaidPage.waitForSelector(".mobile-filter-sheet");
    await capture(mobilePaidPage, server.baseUrl, "mobile-vocab-filter-sheet", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=vocabulary&vocabTab=tester&theme=light", ".vocab-tester-card");
    await capture(mobilePaidPage, server.baseUrl, "mobile-light-vocab-tester", { mobileShell: true, viewportOnly: true });
    await assertLightSelectionPalette(mobilePaidPage, "mobile light vocabulary tester");
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=subscription", ".subscription-hero");
    await capture(mobilePaidPage, server.baseUrl, "mobile-subscription", { mobileShell: true, viewportOnly: true });
    await gotoRoute(mobilePaidPage, server.baseUrl, "?route=account", ".account-hero");
    await capture(mobilePaidPage, server.baseUrl, "mobile-account", { mobileShell: true, viewportOnly: true });

    const nativeMobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
    await login(nativeMobilePage, `${server.baseUrl}/?native=1`, paidTestUser);
    await capture(nativeMobilePage, server.baseUrl, "native-mobile-today", { nativeShell: true, viewportOnly: true });
    await gotoRoute(nativeMobilePage, server.baseUrl, "?native=1&route=vocabulary", ".native-vocabulary-app");
    await capture(nativeMobilePage, server.baseUrl, "native-mobile-flashcards", { nativeShell: true, viewportOnly: true });
    await gotoRoute(nativeMobilePage, server.baseUrl, "?native=1&route=vocabulary&vocabTab=listen", ".native-audio-review-app");
    await capture(nativeMobilePage, server.baseUrl, "native-mobile-listen-review", { nativeShell: true, viewportOnly: true });
    await gotoRoute(nativeMobilePage, server.baseUrl, "?native=1&route=vocabulary&vocabTab=tester", ".native-vocab-tester-app");
    await capture(nativeMobilePage, server.baseUrl, "native-mobile-vocab-tester", { nativeShell: true, viewportOnly: true });
  } finally {
    await browser?.close();
    await server.stop();
  }
}

async function login(page, baseUrl, user) {
  await page.goto(baseUrl);
  await page.locator('[data-auth-mode="login"]').first().click();
  await page.locator('[data-auth-form] input[name="email"]').fill(user.email);
  await page.locator('[data-auth-form] input[name="password"]').fill(user.password);
  await page.locator('[data-auth-form] button[type="submit"]').click();
  await page.waitForSelector(".auth-avatar:visible, .mobile-avatar:visible");
}

async function gotoRoute(page, baseUrl, route, selector) {
  await page.goto(`${baseUrl}/${route}`);
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(selector);
}

async function capture(page, baseUrl, name, options = {}) {
  if (page.url() === "about:blank") await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) throw new Error(`${name} has horizontal overflow`);

  if (options.mobileShell) {
    const mobileState = await page.evaluate(() => {
      const visible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const viewTop = document.querySelector(".view")?.getBoundingClientRect().top || 0;
      return {
        sidebarVisible: visible(".sidebar"),
        mobileAppbarVisible: visible(".mobile-appbar"),
        mobileBottomNavVisible: visible(".mobile-bottom-nav"),
        viewTop
      };
    });
    if (mobileState.sidebarVisible) throw new Error(`${name} shows the desktop sidebar on mobile`);
    if (!mobileState.mobileAppbarVisible) throw new Error(`${name} is missing the mobile app bar`);
    if (!mobileState.mobileBottomNavVisible) throw new Error(`${name} is missing the mobile bottom navigation`);
    if (mobileState.viewTop > 190) throw new Error(`${name} pushes content too far below the mobile app bar`);
  }

  if (options.nativeShell) {
    const nativeState = await page.evaluate(() => {
      const visible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return {
        appMode: document.documentElement.dataset.appMode,
        nativeShellVisible: visible(".native-app-shell"),
        nativeBottomVisible: visible(".native-bottom-nav"),
        mobileSearchVisible: visible(".mobile-search"),
        mobileMoreVisible: visible(".mobile-more-menu"),
        stickyVisible: visible(".mobile-sticky-action")
      };
    });
    if (nativeState.appMode !== "native") throw new Error(`${name} did not render in native app mode`);
    if (!nativeState.nativeShellVisible) throw new Error(`${name} is missing the native shell`);
    if (!nativeState.nativeBottomVisible) throw new Error(`${name} is missing the native bottom navigation`);
    if (nativeState.mobileSearchVisible) throw new Error(`${name} shows the mobile web search bar`);
    if (nativeState.mobileMoreVisible) throw new Error(`${name} shows the mobile web overflow menu`);
    if (nativeState.stickyVisible) throw new Error(`${name} shows the mobile web sticky action`);
  }

  const screenshotPath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: !options.viewportOnly });
  const stat = await fs.stat(screenshotPath);
  if (stat.size < 10_000) throw new Error(`${name} screenshot looks blank or incomplete`);
  console.log(`Captured ${screenshotPath}`);
}

async function assertLightSelectionPalette(page, name) {
  const samples = await page.evaluate(() => {
    const parseRgb = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      return match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
    };
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const visibility = window.getComputedStyle(element);
      if (visibility.display === "none" || visibility.visibility === "hidden" || rect.width === 0 || rect.height === 0) return null;
      const styles = window.getComputedStyle(element);
      return {
        selector,
        color: parseRgb(styles.color),
        background: parseRgb(styles.backgroundColor)
      };
    };

    return [
      read(".lesson-tab.active"),
      read(".vocab-book-card.active"),
      read(".filter-chip.active"),
      read(".mobile-bottom-nav button.active")
    ].filter(Boolean);
  });

  if (!samples.length) throw new Error(`${name} did not expose any selected controls`);

  const yellowText = samples.filter(({ color }) => color && color[0] > 120 && color[1] > 95 && color[2] < 95);
  if (yellowText.length) {
    throw new Error(`${name} has yellow selected text: ${yellowText.map(({ selector }) => selector).join(", ")}`);
  }

  const selectedSurfaces = samples.filter(({ background }) => background);
  const missingSurface = selectedSurfaces.filter(({ background }) => background.every((channel) => channel > 238));
  if (missingSurface.length) {
    throw new Error(`${name} selected controls are too close to the page background: ${missingSurface.map(({ selector }) => selector).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
