import { test, expect } from '@playwright/test';

test('scene renders a canvas and reports stats for the National Mall', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?place=national-mall&count=1000&density=2.5');
  await expect(page.locator('[data-testid="scene"] canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__crowdStats?.radius ?? 0) > 0);
  const stats = await page.evaluate(() => window.__crowdStats!);
  expect(stats.overflow).toBe(false);
  expect(stats.capacity).toBeGreaterThan(1_000_000);
  expect(errors).toEqual([]);
});

test('canvas matches its container at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const canvas = page.locator('[data-testid="scene"] canvas');
  await expect(canvas).toBeVisible();
  const [c, s] = await Promise.all([canvas.boundingBox(), page.getByTestId('scene').boundingBox()]);
  expect(Math.abs(c!.width - s!.width)).toBeLessThan(2);
  expect(Math.abs(c!.height - s!.height)).toBeLessThan(2);
});

test('shows a message without WebGL2 and keeps the sidebar', async ({ page }) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = HTMLCanvasElement.prototype as any;
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2') return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto('/');
  await expect(page.getByText('This needs WebGL2, try a recent Chrome or Safari.')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Crowd controls' })).toBeVisible();
});

test('a scene startup error shows a message and keeps the sidebar', async ({ page }) => {
  await page.addInitScript(() => {
    // Older Safari has no roundRect; the atlas build throws without it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CanvasRenderingContext2D.prototype as any).roundRect = undefined;
  });
  await page.goto('/');
  await expect(page.getByText('The 3D view could not start in this browser.')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Crowd controls' })).toBeVisible();
});
