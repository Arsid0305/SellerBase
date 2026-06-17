import { test, expect } from '@playwright/test';

const PAGES = [
  '/',
  '/dashboard',
  '/products',
  '/products/costs',
  '/pnl',
  '/turnover',
  '/analytics',
  '/analytics/margin',
  '/analytics/pareto',
  '/analytics/weekly',
  '/promo',
  '/deficit',
  '/supplies',
  '/reviews',
  '/customers',
  '/tasks',
  '/goals',
  '/settings/notifications',
  '/data-quality',
];

for (const url of PAGES) {
  test(`smoke: ${url} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const res = await page.goto(url, { waitUntil: 'domcontentloaded' });

    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
    expect(errors, `Page errors on ${url}:\n${errors.join('\n')}`).toEqual([]);
  });
}
