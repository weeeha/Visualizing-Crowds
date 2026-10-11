import { test, expect } from '@playwright/test';

test('typing a count updates the big number and the URL', async ({ page }) => {
  await page.goto('/?place=national-mall&count=1000');
  const input = page.getByLabel('Exact people count');
  await input.fill('1M');
  await input.press('Enter');
  await expect(page.getByTestId('count-big')).toHaveText('1,000,000');
  await expect(page).toHaveURL(/count=1000000/);
});

test('junk input reverts', async ({ page }) => {
  await page.goto('/?count=5000');
  const input = page.getByLabel('Exact people count');
  await input.fill('lots');
  await input.press('Enter');
  await expect(input).toHaveValue('5,000');
});

test('choosing a place and density updates state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Manhattan' }).click();
  await page.getByRole('radio', { name: 'Packed' }).click();
  await expect(page).toHaveURL(/place=manhattan/);
  await expect(page).toHaveURL(/density=4.5/);
  await expect(page.getByRole('radio', { name: 'Manhattan' })).toHaveAttribute('aria-checked', 'true');
});

test('overflow notice appears for Times Square at 1M', async ({ page }) => {
  await page.goto('/?place=times-square&count=1000000');
  await expect(page.getByRole('status')).toContainText('Overflow: Times Square holds about');
});

test('rapid place switching leaves the last place in charge', async ({ page }) => {
  await page.goto('/?place=national-mall&count=1000000');
  await page.getByRole('radio', { name: 'Manhattan' }).click();
  await page.getByRole('radio', { name: 'Times Square' }).click();
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(true); // 1M cannot fit Times Square; a stale Manhattan/Mall state would say false
});

test('highlight toggle writes hl to the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Highlight 1 in').check();
  await expect(page).toHaveURL(/hl=50/);
});
