import { test, expect } from '@playwright/test';

test('Manhattan at 20M renders dots and reports no overflow', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?place=manhattan&count=20000000&density=2.5');
  await page.waitForFunction(() => window.__crowdStats !== undefined);
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(false);
  expect(s.radius).toBeGreaterThan(1000);
  await page.waitForTimeout(1500); // camera flight
  await page.getByTestId('scene').screenshot({ path: info.outputPath('manhattan-20m.png') });
  // From the aerial view people are under a pixel (ground shader only); zoom in until dots appear.
  const box = (await page.getByTestId('scene').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -500); await page.waitForTimeout(100); }
  await page.waitForFunction(() => (window.__crowdStats?.midPoints ?? 0) > 0, null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.getByTestId('scene').screenshot({ path: info.outputPath('manhattan-20m-zoomed.png') });
  expect(errors).toEqual([]);
});

test('Times Square at 1M overflows', async ({ page }) => {
  await page.goto('/?place=times-square&count=1000000&density=2.5');
  await page.waitForFunction(() => window.__crowdStats !== undefined);
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(true);
  expect(s.capacity).toBeLessThan(1_000_000);
});
