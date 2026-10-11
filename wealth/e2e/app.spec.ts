import { expect, test, type Page } from '@playwright/test';

const pileSize = (page: Page) => page.getByTestId('pile-size');
const headline = (page: Page) => page.getByTestId('headline');

async function sceneLooksRendered(page: Page) {
  // A blank or uniform canvas compresses to a few KB; a rendered pile is far larger.
  await expect.poll(async () => (await page.locator('main.scene').screenshot()).length, { timeout: 60_000 }).toBeGreaterThan(30_000);
}

test('opens on the cash pile and renders it', async ({ page }) => {
  await page.goto('/');
  await expect(headline(page)).toHaveText('$1.004T');
  await expect(pileSize(page)).toContainText('17.5 m tall');
  await expect(page.getByTestId('stats')).toContainText('pieces drawn', { timeout: 60_000 });
  await sceneLooksRendered(page);
});

test('the toggle swaps the pile and its height', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats')).toContainText('pieces drawn', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Bodies' }).click();
  await expect(headline(page)).toHaveText('500,000');
  await expect(pileSize(page)).toContainText('28.6 m tall');
  await expect(page).toHaveURL(/pile=bodies/);
  await sceneLooksRendered(page);
});

test('the estimate picker updates the label and the pile', async ({ page }) => {
  await page.goto('/#pile=bodies');
  await page.getByRole('button', { name: /Lancet/ }).click();
  await expect(headline(page)).toHaveText('9,400,000');
  await expect(pileSize(page)).toContainText('76.1 m tall');
});

test('choosing someone else switches to the cash pile', async ({ page }) => {
  await page.goto('/#pile=bodies');
  await page.getByRole('button', { name: 'Jeff Bezos' }).click();
  await expect(headline(page)).toHaveText('$380.8B');
  await expect(page.getByRole('button', { name: 'Cash' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Lancet/ })).toBeDisabled();
});

test('every source link in the methods note opens', async ({ page }) => {
  await page.goto('/');
  await page.getByText('How this is measured').click();
  const links = page.locator('.method a, .count-status a');
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  for (const href of await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) expect(href).toMatch(/^https:\/\//);
});
