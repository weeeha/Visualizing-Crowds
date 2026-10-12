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

test('dropping tiles during the camera flight leaves no broken draws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1200, height: 750 });
  await page.goto('/?place=national-mall&count=180000&density=2.5');
  await page.waitForFunction(() => (window.__crowdStats?.nearSprites ?? 0) > 0, null, { timeout: 60_000 });
  // Orbit and zoom so tiles are dropped while others keep drawing.
  const box = (await page.getByTestId('scene').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(150); }
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => e.includes('WebGL'))).toEqual([]);
});
