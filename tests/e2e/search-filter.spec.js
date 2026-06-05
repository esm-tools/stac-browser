import { test, expect } from '@playwright/test';
import {
  SEARCH_PATH,
  mockApiRootAndCollections,
  waitForSearchPost
} from './helpers';

/**
 * Helper to mock the queryables endpoint with climate-science relevant properties
 */
const mockQueryablesEndpoint = async (page) => {
  await page.route('**/queryables', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$id': 'https://example.com/queryables',
          type: 'object',
          title: 'Queryables',
          properties: {
            'nml:radctl:co2vmr': {
              title: 'CO2 Volume Mixing Ratio',
              type: 'number',
              description: 'CO2 concentration in volume mixing ratio'
            },
            'nml:radctl:ch4vmr': {
              title: 'CH4 Volume Mixing Ratio',
              type: 'number',
              description: 'CH4 concentration in volume mixing ratio'
            },
            'nml:radctl:n2ovmr': {
              title: 'N2O Volume Mixing Ratio',
              type: 'number',
              description: 'N2O concentration in volume mixing ratio'
            },
            'model': {
              title: 'Model Component',
              type: 'string',
              enum: ['echam', 'fesom', 'jsbach', 'hdmodel', 'oasis', 'recom']
            },
            'experiment_type': {
              title: 'Experiment Type',
              type: 'string'
            },
            'paleo:years_bp': {
              title: 'Years Before Present',
              type: 'number'
            }
          }
        })
      });
      return;
    }
    await route.continue();
  });
};

/**
 * Helper to mock paleo presets endpoint
 */
const mockPaleoPresetsEndpoint = async (page) => {
  await page.route('**/paleo-presets', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          presets: [
            { id: 'lgm', name: 'LGM', display: '21.0 ka', years_bp: 21000, description: 'Last Glacial Maximum' },
            { id: 'mid_holocene', name: 'Mid-Holocene', display: '6.0 ka', years_bp: 6000, description: 'Mid-Holocene warm period' },
            { id: 'eemian', name: 'Eemian', display: '125.0 ka', years_bp: 125000, description: 'Last Interglacial' },
            { id: 'preindustrial', name: 'PI', display: '1850 CE', years_bp: 100, description: 'Pre-industrial' }
          ]
        })
      });
      return;
    }
    await route.continue();
  });
};

/**
 * Combined mock setup for all search filter tests
 */
const setupMocks = async (page) => {
  await mockApiRootAndCollections(page);
  await mockQueryablesEndpoint(page);
  await mockPaleoPresetsEndpoint(page);
};

test.describe('SearchFilter Quick Filters UI', () => {
  test('Should render quick filters section with all components', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Verify Quick Filters section is visible', async () => {
      const quickFiltersLabel = page.getByText('Quick Filters');
      await expect(quickFiltersLabel).toBeVisible();
    });

    await test.step('Verify Model Components section exists', async () => {
      const modelComponentsLabel = page.getByText('Model Components');
      await expect(modelComponentsLabel).toBeVisible();
    });

    await test.step('Verify CO2 Level inputs exist', async () => {
      const co2Label = page.getByText('CO2 Level (ppm)');
      await expect(co2Label).toBeVisible();
    });

    await test.step('Verify CH4 Level inputs exist', async () => {
      const ch4Label = page.getByText('CH4 Level (ppb)');
      await expect(ch4Label).toBeVisible();
    });

    await test.step('Verify N2O Level inputs exist', async () => {
      const n2oLabel = page.getByText('N2O Level (ppb)');
      await expect(n2oLabel).toBeVisible();
    });

    await test.step('Verify Experiment Type dropdown exists', async () => {
      // Use more specific selector - the label in Quick Filters section
      const experimentTypeLabel = page.locator('.quick-filters').getByText('Experiment Type');
      await expect(experimentTypeLabel).toBeVisible();
    });

    await test.step('Verify Output Frequency dropdown exists', async () => {
      const frequencyLabel = page.locator('.quick-filters').getByText('Output Frequency');
      await expect(frequencyLabel).toBeVisible();
    });
  });

  test('Should render CO2 preset buttons', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Verify PI (284) preset button exists', async () => {
      const piButton = page.getByRole('button', { name: /PI \(284\)/i });
      await expect(piButton).toBeVisible();
    });

    await test.step('Verify 2xCO2 preset button exists', async () => {
      const twoXButton = page.getByRole('button', { name: /2xCO2/i });
      await expect(twoXButton).toBeVisible();
    });

    await test.step('Verify 4xCO2 preset button exists', async () => {
      const fourXButton = page.getByRole('button', { name: /4xCO2/i });
      await expect(fourXButton).toBeVisible();
    });
  });
});

test.describe('SearchFilter CO2 Preset Buttons', () => {
  test('PI preset should set CO2 range to 280-290 ppm', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Click PI preset button', async () => {
      const piButton = page.getByRole('button', { name: /PI \(284\)/i });
      await piButton.click();
    });

    await test.step('Verify CO2 min/max values are set correctly', async () => {
      // Find the CO2 inputs - they are in the quick-filter-row containing "CO2 Level"
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      const minInput = co2Row.locator('input[type="number"]').first();
      const maxInput = co2Row.locator('input[type="number"]').last();

      await expect(minInput).toHaveValue('280');
      await expect(maxInput).toHaveValue('290');
    });
  });

  test('2xCO2 preset should set CO2 range to 550-570 ppm', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Click 2xCO2 preset button', async () => {
      const twoXButton = page.getByRole('button', { name: /2xCO2/i });
      await twoXButton.click();
    });

    await test.step('Verify CO2 min/max values are set correctly', async () => {
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      const minInput = co2Row.locator('input[type="number"]').first();
      const maxInput = co2Row.locator('input[type="number"]').last();

      await expect(minInput).toHaveValue('550');
      await expect(maxInput).toHaveValue('570');
    });
  });

  test('4xCO2 preset should set CO2 range to 1100-1140 ppm', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Click 4xCO2 preset button', async () => {
      const fourXButton = page.getByRole('button', { name: /4xCO2/i });
      await fourXButton.click();
    });

    await test.step('Verify CO2 min/max values are set correctly', async () => {
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      const minInput = co2Row.locator('input[type="number"]').first();
      const maxInput = co2Row.locator('input[type="number"]').last();

      await expect(minInput).toHaveValue('1100');
      await expect(maxInput).toHaveValue('1140');
    });
  });
});

test.describe('SearchFilter GHG Unit Conversion', () => {
  test('CO2 filter should convert ppm to decimal in CQL2 filter', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Enter CO2 range in ppm', async () => {
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      const minInput = co2Row.locator('input[type="number"]').first();
      const maxInput = co2Row.locator('input[type="number"]').last();

      await minInput.fill('400');
      await maxInput.fill('500');
    });

    await test.step('Submit search and verify CQL2 filter has decimal values', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      // The filter should contain CO2 values converted from ppm to decimal
      // 400 ppm = 400 * 1e-6 = 0.0004
      // 500 ppm = 500 * 1e-6 = 0.0005
      expect(body.filter).toBeDefined();

      // Convert filter to string for easier inspection
      const filterJson = JSON.stringify(body.filter);

      // Check that the CO2 field is referenced
      expect(filterJson).toContain('nml:radctl:co2vmr');

      // Check that values are in decimal format (should be small numbers like 0.0004)
      // The exact structure depends on CQL2 format, but values should be < 1
      expect(filterJson).toMatch(/0\.000[0-9]/);
    });
  });

  test('CH4 filter should convert ppb to decimal in CQL2 filter', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Enter CH4 range in ppb', async () => {
      const ch4Row = page.locator('.quick-filter-row').filter({ hasText: 'CH4 Level' });
      const minInput = ch4Row.locator('input[type="number"]').first();
      const maxInput = ch4Row.locator('input[type="number"]').last();

      await minInput.fill('1800');
      await maxInput.fill('2000');
    });

    await test.step('Submit search and verify CQL2 filter has decimal values', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // Check that the CH4 field is referenced
      expect(filterJson).toContain('nml:radctl:ch4vmr');

      // 1800 ppb = 1800 * 1e-9 = 0.0000018
      // Values should be very small (in the e-6 range)
      expect(filterJson).toMatch(/[0-9]\.[0-9]+e-[0-9]|0\.0000[0-9]/);
    });
  });

  test('N2O filter should convert ppb to decimal in CQL2 filter', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Enter N2O range in ppb', async () => {
      const n2oRow = page.locator('.quick-filter-row').filter({ hasText: 'N2O Level' });
      const minInput = n2oRow.locator('input[type="number"]').first();
      const maxInput = n2oRow.locator('input[type="number"]').last();

      await minInput.fill('300');
      await maxInput.fill('350');
    });

    await test.step('Submit search and verify CQL2 filter has decimal values', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // Check that the N2O field is referenced
      expect(filterJson).toContain('nml:radctl:n2ovmr');

      // 300 ppb = 300 * 1e-9 = 0.0000003
      expect(filterJson).toMatch(/[0-9]\.[0-9]+e-[0-9]|0\.0000[0-9]/);
    });
  });
});

test.describe('SearchFilter Paleo Presets', () => {
  test('Should display paleo time period presets when available', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    // Wait for paleo presets to load
    await page.waitForLoadState('networkidle');

    await test.step('Verify Paleo Time Period label is visible', async () => {
      const paleoLabel = page.getByText('Paleo Time Period');
      await expect(paleoLabel).toBeVisible();
    });

    await test.step('Verify LGM preset button exists', async () => {
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await expect(lgmButton).toBeVisible();
    });

    await test.step('Verify Mid-Holocene preset button exists', async () => {
      const midHoloceneButton = page.getByRole('button', { name: /Mid-Holocene/i });
      await expect(midHoloceneButton).toBeVisible();
    });

    await test.step('Verify Eemian preset button exists', async () => {
      const eemianButton = page.getByRole('button', { name: /^Eemian$/i });
      await expect(eemianButton).toBeVisible();
    });

    await test.step('Verify PI preset button exists', async () => {
      const piButton = page.getByRole('button', { name: /^PI$/i });
      await expect(piButton).toBeVisible();
    });
  });

  test('Selecting a paleo preset should highlight the button', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Click LGM preset and verify it becomes selected', async () => {
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await lgmButton.click();

      // The selected button should have variant 'info' instead of 'outline-info'
      // This typically translates to a different class
      await expect(lgmButton).toHaveClass(/btn-info/);
    });

    await test.step('Verify Clear button appears after selection', async () => {
      const clearButton = page.getByRole('button', { name: /^Clear$/i });
      await expect(clearButton).toBeVisible();
    });
  });

  test('Clear button should deselect paleo preset', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Select LGM preset', async () => {
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await lgmButton.click();
      await expect(lgmButton).toHaveClass(/btn-info/);
    });

    await test.step('Click Clear button and verify preset is deselected', async () => {
      const clearButton = page.getByRole('button', { name: /^Clear$/i });
      await clearButton.click();

      // After clearing, LGM should have outline-info variant
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await expect(lgmButton).toHaveClass(/btn-outline-info/);

      // Clear button should be hidden
      await expect(clearButton).not.toBeVisible();
    });
  });

  test('Paleo preset selection should include years_bp filter in search', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Select LGM preset (21000 years BP)', async () => {
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await lgmButton.click();
    });

    await test.step('Submit search and verify paleo filter is included', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // Check that paleo years_bp field is referenced
      expect(filterJson).toContain('paleo:years_bp');

      // LGM is 21000 years BP, with 10% tolerance = 18900 to 23100
      // Check for values in that range
      expect(filterJson).toMatch(/1[89][0-9]{3}|2[0-3][0-9]{3}/);
    });
  });
});

test.describe('SearchFilter Form Submission with Quick Filters', () => {
  test('Search submission should include model component filters', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Select ECHAM model component', async () => {
      // Model components are rendered as checkbox-group with button styling
      const echamLabel = page.locator('.quick-filters').getByText('ECHAM');
      await echamLabel.click();
    });

    await test.step('Submit search and verify model filter is included', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // Check that model field is referenced
      expect(filterJson).toContain('model');
      expect(filterJson).toContain('echam');
    });
  });

  test('Search submission should include experiment type filter', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Select Historical experiment type', async () => {
      const experimentSelect = page.locator('.quick-filter-row').filter({ hasText: 'Experiment Type' }).locator('select');
      await experimentSelect.selectOption('historical');
    });

    await test.step('Submit search and verify experiment type filter is included', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // Check that experiment_type is in the filter
      expect(filterJson).toContain('experiment_type');
      expect(filterJson).toContain('historical');
    });
  });

  test('Search submission should include multiple quick filters combined', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Set multiple quick filters', async () => {
      // Set CO2 range
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      await co2Row.locator('input[type="number"]').first().fill('280');
      await co2Row.locator('input[type="number"]').last().fill('300');

      // Select model component (checkbox-group with button styling)
      const fesom = page.locator('.quick-filters').getByText('FESOM');
      await fesom.click();

      // Select paleo preset
      const lgmButton = page.getByRole('button', { name: /^LGM$/i });
      await lgmButton.click();
    });

    await test.step('Submit search and verify all filters are combined', async () => {
      const requestPromise = waitForSearchPost(page);
      const submitButton = page.getByRole('button', { name: /submit/i });
      await submitButton.click();

      const { body } = await requestPromise;

      expect(body.filter).toBeDefined();

      const filterJson = JSON.stringify(body.filter);

      // All fields should be present in the combined filter
      expect(filterJson).toContain('nml:radctl:co2vmr');
      expect(filterJson).toContain('model');
      expect(filterJson).toContain('fesom');
      expect(filterJson).toContain('paleo:years_bp');
    });
  });

  test('Reset button should clear all quick filters', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Set some quick filters', async () => {
      // Set CO2 range using PI preset
      const piButton = page.getByRole('button', { name: /PI \(284\)/i });
      await piButton.click();

      // Verify values are set
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      await expect(co2Row.locator('input[type="number"]').first()).toHaveValue('280');
    });

    await test.step('Click Reset button', async () => {
      const resetButton = page.getByRole('button', { name: /reset/i });
      await resetButton.click();
    });

    await test.step('Verify quick filters are cleared', async () => {
      const co2Row = page.locator('.quick-filter-row').filter({ hasText: 'CO2 Level' });
      const minInput = co2Row.locator('input[type="number"]').first();
      const maxInput = co2Row.locator('input[type="number"]').last();

      // Inputs should be empty after reset
      await expect(minInput).toHaveValue('');
      await expect(maxInput).toHaveValue('');
    });
  });
});

test.describe('SearchFilter Queryables Search', () => {
  test('Should display Additional Filters dropdown with search input', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Verify Additional Filters section exists', async () => {
      const additionalFiltersLabel = page.getByText('Additional Filters');
      await expect(additionalFiltersLabel).toBeVisible();
    });

    await test.step('Open Add Filter dropdown', async () => {
      const addFilterButton = page.getByRole('button', { name: /add filter/i });
      await addFilterButton.click();

      // Verify dropdown menu appears
      const dropdownMenu = page.locator('.queryables-menu');
      await expect(dropdownMenu).toBeVisible();
    });

    await test.step('Verify filter search input exists', async () => {
      const searchInput = page.locator('.queryables-search input');
      await expect(searchInput).toBeVisible();
    });
  });

  test('Queryables search should filter properties by name', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Open Add Filter dropdown and search for CO2', async () => {
      const addFilterButton = page.getByRole('button', { name: /add filter/i });
      await addFilterButton.click();

      const searchInput = page.locator('.queryables-search input');
      await searchInput.fill('CO2');
    });

    await test.step('Verify only CO2-related group is shown and can be expanded', async () => {
      const dropdownMenu = page.locator('.queryables-menu');

      // Should show the Radctl group (contains CO2)
      const radctlGroup = dropdownMenu.locator('.queryable-group-header').filter({ hasText: 'Radctl' });
      await expect(radctlGroup).toBeVisible();

      // Expand the group to see individual properties
      await radctlGroup.click();

      // Should show co2vmr property after expanding (visible as badge)
      await expect(dropdownMenu.getByText('co2vmr')).toBeVisible();

      // ch4vmr and n2ovmr should not be visible (filtered out by search)
      await expect(dropdownMenu.getByText('ch4vmr')).not.toBeVisible();
      await expect(dropdownMenu.getByText('n2ovmr')).not.toBeVisible();
    });
  });

  test('Searching for non-existent property should show no results message', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await test.step('Search for non-existent property', async () => {
      const addFilterButton = page.getByRole('button', { name: /add filter/i });
      await addFilterButton.click();

      const searchInput = page.locator('.queryables-search input');
      await searchInput.fill('xyz_nonexistent_property_123');
    });

    await test.step('Verify no matching properties message is shown', async () => {
      // The dropdown menu should show no groups or properties
      const dropdownMenu = page.locator('.queryables-menu');
      // Match either translated text or i18n key fallback
      const noResultsMessage = dropdownMenu.getByText(/no matching properties|noMatchingProperties/i);
      await expect(noResultsMessage).toBeVisible();
    });
  });
});

test.describe('SearchFilter Output Frequency Dropdown', () => {
  test('Should display frequency options in dropdown', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Verify frequency dropdown has expected options', async () => {
      const frequencySelect = page.locator('.quick-filter-row').filter({ hasText: 'Output Frequency' }).locator('select');

      // Check select element is visible
      await expect(frequencySelect).toBeVisible();

      // Verify some key options exist
      const options = frequencySelect.locator('option');
      await expect(options).toHaveCount(7); // Any Frequency + 6 time intervals
    });
  });

  test('Selecting frequency should update the dropdown value', async ({ page }) => {
    await setupMocks(page);
    await page.goto(SEARCH_PATH);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await test.step('Select Monthly frequency', async () => {
      const frequencySelect = page.locator('.quick-filter-row').filter({ hasText: 'Output Frequency' }).locator('select');
      await frequencySelect.selectOption('mon');

      await expect(frequencySelect).toHaveValue('mon');
    });
  });
});
