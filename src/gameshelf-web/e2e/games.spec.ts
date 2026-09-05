import { expect, test, type Page } from '@playwright/test';

// Each run uses a unique title so it never collides with existing rows in the shared dev database.
const runId = Date.now();
const title = `E2E Game ${runId}`;
const updatedTitle = `${title} (Deluxe)`;

async function addGame(page: Page, values: { title: string; platform: string; condition: string; value: string }) {
  await page.getByTestId('input-title').fill(values.title);
  await page.getByTestId('input-platform').fill(values.platform);
  await page.getByTestId('input-condition').selectOption(values.condition);
  await page.getByTestId('input-value').fill(values.value);
  await page.getByTestId('submit-game').click();
}

test.describe('GameShelf collection', () => {
  test('loads the collection page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'GameShelf' })).toBeVisible();
    await expect(page.getByTestId('loading')).toBeHidden();
    await expect(page.getByTestId('empty-state').or(page.getByTestId('game-table'))).toBeVisible();
  });

  test('adds, edits, and deletes a game', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading')).toBeHidden();

    // Create
    await addGame(page, { title, platform: 'Dreamcast', condition: 'Mint', value: '42.5' });
    const row = page.getByTestId(/game-row-/).filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText('$42.50');
    await expect(row).toContainText('Mint');
    await expect(page.getByTestId('input-title')).toHaveValue('');

    // Update
    await row.getByTestId('edit-game').click();
    await expect(page.getByRole('heading', { name: `Edit “${title}”` })).toBeVisible();
    await page.getByTestId('input-title').fill(updatedTitle);
    await page.getByTestId('input-condition').selectOption('Good');
    await page.getByTestId('submit-game').click();

    const updatedRow = page.getByTestId(/game-row-/).filter({ hasText: updatedTitle });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText('Good');
    await expect(page.getByRole('heading', { name: 'Add a game' })).toBeVisible();

    // Delete
    page.once('dialog', (dialog) => dialog.accept());
    await updatedRow.getByTestId('delete-game').click();
    await expect(updatedRow).toBeHidden();
  });

  test('rejects an empty title without leaving the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading')).toBeHidden();

    await page.getByTestId('input-platform').fill('PC');
    await page.getByTestId('submit-game').click();

    // Native `required` validation blocks submission; the form is still on screen.
    await expect(page.getByTestId('input-title')).toBeFocused();
    await expect(page.getByTestId('error')).toBeHidden();
  });
});
