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

test('highlight ratio accepts multi-digit values like 100', async ({ page }) => {
  await page.goto('/?hl=50');
  const ratio = page.getByLabel('Highlight ratio');
  await ratio.selectText();
  await ratio.press('Backspace');
  await ratio.pressSequentially('100'); // typed like a person: "1", "10", "100"
  await ratio.press('Enter');
  await expect(page).toHaveURL(/hl=100/);
});

test('overflow status is correct immediately, not after the next stats tick', async ({ page }) => {
  await page.goto('/?place=times-square&count=1000000');
  await expect(page.getByRole('status')).toContainText('Overflow: Times Square holds about 15,988', { timeout: 150 });
  await page.getByRole('radio', { name: 'Michigan Stadium' }).click();
  await expect(page.getByRole('status')).toContainText('Overflow: Michigan Stadium holds about 119,170', { timeout: 150 });
});

test('typed count snaps to the formatted value even when the count does not change', async ({ page }) => {
  await page.goto('/?count=50');
  const input = page.getByLabel('Exact people count');
  await input.fill('-5');
  await input.press('Enter');
  await expect(input).toHaveValue('50');
});

test('credits OpenStreetMap for place outlines', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});
