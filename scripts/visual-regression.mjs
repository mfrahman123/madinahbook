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
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await capture(desktop, server.baseUrl, "public-home-desktop");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await capture(mobile, server.baseUrl, "public-home-mobile");

    const freePage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(freePage, server.baseUrl, testUser);
    await freePage.locator('[data-route="book-2"]').click();
    await freePage.waitForSelector("text=Upgrade to Premium");
    await capture(freePage, server.baseUrl, "free-upgrade-gate");

    const paidPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(paidPage, server.baseUrl, paidTestUser);
    await paidPage.locator('[data-route="book-2"]').click();
    await paidPage.waitForSelector("text=إِنَّ, لَعَلَّ, ذُو and Large Numbers");
    await capture(paidPage, server.baseUrl, "premium-book-2");

    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(adminPage, server.baseUrl, paidTestUser);
    await adminPage.locator('[data-route="admin"]').click();
    await adminPage.waitForSelector("text=Content Management");
    await capture(adminPage, server.baseUrl, "admin-content");
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
  await page.waitForSelector(".auth-avatar");
}

async function capture(page, baseUrl, name) {
  if (page.url() === "about:blank") await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) throw new Error(`${name} has horizontal overflow`);

  const screenshotPath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const stat = await fs.stat(screenshotPath);
  if (stat.size < 10_000) throw new Error(`${name} screenshot looks blank or incomplete`);
  console.log(`Captured ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
