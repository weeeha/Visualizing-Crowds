import { expect, test } from '@playwright/test';

test('the ranking opens on the whole row, renders, and follows a selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/ranking.html');
  await expect(page.getByTestId('headline')).toHaveText('36,500,000');
  await expect(page.getByTestId('pile-size')).toContainText('119.6 m tall');
  // A blank canvas compresses to a few KB; a rendered row is far larger.
  await expect.poll(async () => (await page.locator('main.scene').screenshot()).length, { timeout: 60_000 }).toBeGreaterThan(30_000);

  await page.locator('.rank-row', { hasText: 'Suharto' }).click();
  await expect(page.getByTestId('headline')).toHaveText('500,000');
  await expect(page.getByTestId('pile-size')).toContainText('28.6 m tall');
  await expect(page).toHaveURL(/leader=suharto/);
  await expect(page).toHaveURL(/view=close/);

  await page.getByRole('button', { name: 'High end' }).click();
  await page.locator('.rank-row', { hasText: 'Mao Zedong' }).click();
  await expect(page.getByTestId('headline')).toHaveText('45,000,000');
  expect(errors).toEqual([]);
});
