import { test, expect } from '@playwright/test';
import {
  SEARCH_PATH,
  mockApiRootAndCollections,
  waitForSearchPost
} from './helpers';

// NOTE: Spatial extent helpers removed - all climate models in this catalog are global

test.describe('STAC Browser Search page', () => {
  test('Should load the Search page successfully', async ({ page }) => {
    await mockApiRootAndCollections(page);
    // Navigate to the search page
    await page.goto(SEARCH_PATH);
    
    // Verify the page loads without errors
    await expect(page.getByRole('heading', { name: 'Search' }), 'search heading should be visible').toBeVisible();
  });

  test('Search with default selection should have empty POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);
    
    const requestPromise = waitForSearchPost(page);

    await test.step('Submit search with default selection', async () => {
      const submitButton = page.getByRole('button', { name: /submit/i });

      // Submit search with default selection
      await submitButton.click();
    })

    await test.step('Verify POST body is empty', async () => {
      const { body } = await requestPromise;
      expect(body).toEqual({});
    });

  });

  test('Search with temporal extent selection should have valid POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);

    await test.step('Enter a temporal extent', async () => {
      const temporalInput = page.getByPlaceholder(/select date range/i);

      await temporalInput.click();
      await temporalInput.fill('2025-01-01 - 2026-12-31');
      

    })

    await test.step('Submit search and verify POST body contains correct datetime', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;
      expect(body.datetime).toContain('2025-01-01');
      expect(body.datetime).toContain('2026-12-31');
    });
  });

  // NOTE: Spatial extent tests removed - all climate models in this catalog are global
  // Spatial filtering may be re-added if paleoclimate proxies are included

  test('Search with Collection ID should have valid POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);

    await test.step('Enter a collection ID', async () => {
      const collectionSelect = page.locator('.filter-collection .multiselect');
      await collectionSelect.click();

      const collectionInput = collectionSelect.locator('input.multiselect__input');
      await collectionInput.fill('test-collection-1');
      await collectionInput.press('Enter');
    });

    await test.step('Submit search and verify POST body contains collection ID', async () => {
      const submitButton = page.getByRole('button', { name: /submit/i });
      const requestPromise = waitForSearchPost(page);
      await submitButton.click();

      const { body } = await requestPromise;
      expect(body.collections).toContain('test-collection-1');
    });
  });

  test('search with Item ID should have valid POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);
    
    await test.step('Enter an item ID', async () => {
      const itemIdsGroup = page.locator('.filter-item-id');
      const multiselect = itemIdsGroup.locator('.multiselect');

      // Click the visible tags/placeholder area to activate
      await multiselect.locator('.multiselect__tags').click();

      const idInput = multiselect.locator('input.multiselect__input');
      await expect(idInput).toBeVisible();

      await idInput.fill('test123');
      await idInput.press('Enter');
    });

    await test.step('Submit search and verify POST body contains item ID', async () => {
      const submitButton = page.getByRole('button', { name: /submit/i });
      const requestPromise = waitForSearchPost(page);
      await submitButton.click();

      const { body } = await requestPromise;
      expect(body.ids).toContain('test123');
    });
  });

  test('search with Sort should have valid POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);

    await test.step('Select to sort by title field', async () => {
      const sortSelect = page.locator('.sort .multiselect');
      await sortSelect.locator('.multiselect__select').click();

      const sortInput = sortSelect.locator('input.multiselect__input');
      await sortInput.fill('title');
      await sortInput.press('Enter');
    });

    await test.step('Submit search and verify POST body contains sortby field', async () => {
      const submitButton = page.getByRole('button', { name: /submit/i });
      const requestPromise = waitForSearchPost(page);
      await submitButton.click();

      const { body } = await requestPromise;
      expect(body.sortby).toHaveLength(1);
      expect(body.sortby[0].field).toBe('properties.title');
      expect(body.sortby[0].direction).toBe('asc');
    });
  });

  test('search with item limit should have valid POST body', async ({ page }) => {
    await mockApiRootAndCollections(page);
    await page.goto(SEARCH_PATH);

    await test.step('Set limit of 99 items per', async () => {
      const limitInput = page.getByLabel(/items per page/i);
      await limitInput.fill('99');
    });

    await test.step('Submit search and verify POST body contains limit', async () => {
      const submitButton = page.getByRole('button', { name: /submit/i });
      const requestPromise = waitForSearchPost(page);
      await submitButton.click();

      const { body } = await requestPromise;
      expect(body.limit).toBe(99);
    });
  });
});
