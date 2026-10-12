import { test, expect } from '@playwright/test';

test('app shell renders sidebar and scene container', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Crowd controls' })).toBeVisible();
  await expect(page.getByTestId('scene')).toBeVisible();
  expect(errors).toEqual([]);
});
