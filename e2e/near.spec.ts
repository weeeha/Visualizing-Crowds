import { test, expect } from '@playwright/test';

test('near tier draws sprites on the National Mall', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?place=national-mall&count=1000&density=2.5');
  await page.waitForFunction(() => (window.__crowdStats?.nearSprites ?? 0) > 0, null, { timeout: 60_000 });
  await page.waitForTimeout(1500); // let the camera flight finish
  await page.getByTestId('scene').screenshot({ path: info.outputPath('mall-1k.png') });
  expect(errors).toEqual([]);
});
