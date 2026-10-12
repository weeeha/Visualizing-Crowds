import { test, expect } from '@playwright/test';

test('GLSL hash matches the TypeScript hash bit for bit', async ({ page }) => {
  await page.goto('/hash-test.html');
  await page.waitForFunction(() => window.__hashParity !== undefined);
  const r = await page.evaluate(() => window.__hashParity!);
  expect(r.total).toBe(4 * 64 * 64);
  expect(r.mismatches).toBe(0);
  expect(r.ok).toBe(true);
});
