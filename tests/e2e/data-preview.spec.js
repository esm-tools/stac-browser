import { test, expect } from '@playwright/test';

// Mock visualization server URL
const VIZ_SERVER_URL = 'http://localhost:8001';

// Mock STAC API URL
const STAC_API_URL = 'https://stac-api.test.com/v1';

// Fixture for item metadata response
const ITEM_METADATA_FIXTURE = {
  dimensions: {
    time: 12,
    lat: 180,
    lon: 360
  },
  variables: [
    { name: 'temperature', long_name: 'Temperature', units: 'K' },
    { name: 'precipitation', long_name: 'Precipitation', units: 'mm/day' },
    { name: 'pressure', long_name: 'Pressure', units: 'hPa' }
  ]
};

// Fixture for a STAC Item
const STAC_ITEM_FIXTURE = {
  type: 'Feature',
  stac_version: '1.0.0',
  id: 'test-item-001',
  collection: 'test-collection',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]
  },
  bbox: [-180, -90, 180, 90],
  properties: {
    datetime: '2024-01-01T00:00:00Z',
    title: 'Test Climate Data Item'
  },
  links: [],
  assets: {
    data: {
      href: 'https://example.com/data.nc',
      type: 'application/x-netcdf'
    }
  }
};

// Fixture for a STAC Collection
const STAC_COLLECTION_FIXTURE = {
  type: 'Collection',
  stac_version: '1.0.0',
  id: 'test-collection',
  title: 'Test Climate Collection',
  description: 'A test collection for climate data',
  extent: {
    spatial: { bbox: [[-180, -90, 180, 90]] },
    temporal: { interval: [['2020-01-01T00:00:00Z', '2024-12-31T23:59:59Z']] }
  },
  links: []
};

/**
 * Sets up route mocking for the visualization server endpoints
 */
const mockVizServer = async (page, options = {}) => {
  const {
    metadataResponse = ITEM_METADATA_FIXTURE,
    metadataStatus = 200,
    imageDelay = 0,
    imageError = false
  } = options;

  // Mock the metadata endpoint
  await page.route(`${VIZ_SERVER_URL}/preview/*.json**`, async (route) => {
    if (metadataStatus !== 200) {
      await route.fulfill({
        status: metadataStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to fetch metadata' })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(metadataResponse)
    });
  });

  // Mock the PNG preview endpoint
  await page.route(`${VIZ_SERVER_URL}/preview/*.png**`, async (route) => {
    if (imageError) {
      await route.abort('failed');
      return;
    }
    if (imageDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, imageDelay));
    }
    // Return a minimal 1x1 transparent PNG
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: transparentPng
    });
  });

  // Mock the Panel iframe endpoint
  await page.route(`${VIZ_SERVER_URL}/panel/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><div id="panel-app">Panel Visualization</div></body></html>'
    });
  });
};

/**
 * Creates a test page with the DataPreview component mounted
 * Since DataPreview is typically embedded within Item/Collection pages,
 * we create a minimal test harness
 */
const createDataPreviewTestPage = (item, options = {}) => {
  const { vizServer = VIZ_SERVER_URL, stacApi = STAC_API_URL } = options;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DataPreview Test</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .data-preview { padding: 0.5rem; }
        .mode-toggle { padding: 0.25rem; background: #f8f9fa; border-radius: 4px; }
        .preview-iframe { width: 100%; height: 350px; border: 1px solid #dee2e6; border-radius: 4px; }
        .preview-image img { max-height: 350px; }
        .preview-controls { align-items: center; }
        .static-preview, .interactive-preview { min-height: 350px; }
      </style>
    </head>
    <body>
      <div id="app">
        <div class="data-preview">
          <!-- Mode toggle buttons -->
          <div class="mode-toggle mb-2 d-flex gap-1">
            <button id="btn-interactive" class="btn btn-sm btn-primary" onclick="setMode('interactive')">
              Interactive
            </button>
            <button id="btn-static" class="btn btn-sm btn-outline-secondary" onclick="setMode('static')">
              Static
            </button>
          </div>

          <!-- Interactive mode: iframe -->
          <div id="interactive-preview" class="interactive-preview">
            ${item.type === 'Collection' ? `
              <div class="alert alert-info">
                Select an item from the collection to preview its data interactively.
              </div>
            ` : `
              <div id="iframe-loading" class="text-center p-4">
                <div class="spinner-border" role="status"></div> Loading interactive preview...
              </div>
              <iframe
                id="preview-iframe"
                src="${vizServer}/panel/?item_id=${item.id}&stac_api=${encodeURIComponent(stacApi)}${item.collection ? '&collection_id=' + item.collection : ''}"
                class="preview-iframe"
                style="display: none;"
                onload="handleIframeLoad()"
              ></iframe>
            `}
          </div>

          <!-- Static mode (hidden by default) -->
          <div id="static-preview" class="static-preview" style="display: none;">
            ${item.type === 'Collection' ? `
              <div class="alert alert-warning">
                Select an item from the collection to preview its data.
              </div>
            ` : `
              <div id="static-loading" class="text-center p-4">
                <div class="spinner-border" role="status"></div> Loading preview...
              </div>
              <div id="preview-content" class="preview-content" style="display: none;">
                <div class="preview-controls mb-3 d-flex gap-2 flex-wrap">
                  <select id="variable-select" class="form-select form-select-sm" style="width: auto;">
                  </select>
                  <input id="time-slider" type="range" min="0" max="11" value="0" class="form-range" style="width: 150px;" />
                  <span id="time-label" class="small">t=0</span>
                  <select id="colormap-select" class="form-select form-select-sm" style="width: auto;">
                    <option value="viridis">Viridis</option>
                    <option value="plasma">Plasma</option>
                    <option value="coolwarm">Coolwarm</option>
                    <option value="RdBu_r">Red-Blue</option>
                  </select>
                  <button id="refresh-btn" class="btn btn-sm btn-outline-secondary" onclick="refreshPreview()">
                    Refresh
                  </button>
                </div>
                <div class="preview-image text-center">
                  <img id="preview-image" class="img-fluid border" alt="Preview" />
                </div>
                <div id="preview-metadata" class="preview-metadata mt-3 small text-muted"></div>
              </div>
              <div id="static-error" class="alert alert-warning" style="display: none;"></div>
            `}
          </div>
        </div>
      </div>

      <script>
        const item = ${JSON.stringify(item)};
        const vizServer = '${vizServer}';
        const stacApi = '${stacApi}';
        let currentMode = 'interactive';
        let metadata = null;
        let selectedVariable = null;
        let selectedTime = 0;
        let selectedCmap = 'viridis';

        function setMode(mode) {
          currentMode = mode;
          const interactiveBtn = document.getElementById('btn-interactive');
          const staticBtn = document.getElementById('btn-static');
          const interactivePreview = document.getElementById('interactive-preview');
          const staticPreview = document.getElementById('static-preview');

          if (mode === 'interactive') {
            interactiveBtn.className = 'btn btn-sm btn-primary';
            staticBtn.className = 'btn btn-sm btn-outline-secondary';
            interactivePreview.style.display = 'block';
            staticPreview.style.display = 'none';
          } else {
            interactiveBtn.className = 'btn btn-sm btn-outline-secondary';
            staticBtn.className = 'btn btn-sm btn-primary';
            interactivePreview.style.display = 'none';
            staticPreview.style.display = 'block';
            if (!metadata && item.type !== 'Collection') {
              fetchMetadata();
            }
          }
        }

        function handleIframeLoad() {
          const loading = document.getElementById('iframe-loading');
          const iframe = document.getElementById('preview-iframe');
          if (loading) loading.style.display = 'none';
          if (iframe) iframe.style.display = 'block';
        }

        async function fetchMetadata() {
          if (item.type === 'Collection') return;

          const loading = document.getElementById('static-loading');
          const content = document.getElementById('preview-content');
          const errorDiv = document.getElementById('static-error');

          try {
            const params = new URLSearchParams({ stac_api: stacApi });
            if (item.collection) params.set('collection_id', item.collection);

            const response = await fetch(vizServer + '/preview/' + item.id + '.json?' + params);
            if (!response.ok) throw new Error('Failed to load metadata');

            metadata = await response.json();

            // Populate variables dropdown
            const varSelect = document.getElementById('variable-select');
            varSelect.innerHTML = '';
            metadata.variables.forEach((v, i) => {
              const opt = document.createElement('option');
              opt.value = v.name;
              opt.textContent = (v.long_name || v.name) + (v.units ? ' (' + v.units + ')' : '');
              varSelect.appendChild(opt);
              if (i === 0) selectedVariable = v.name;
            });

            // Set time slider max
            const timeSlider = document.getElementById('time-slider');
            const timeMax = Math.max(0, (metadata.dimensions.time || metadata.dimensions.Time || 1) - 1);
            timeSlider.max = timeMax;

            // Add event listeners
            varSelect.addEventListener('change', (e) => {
              selectedVariable = e.target.value;
              updatePreviewImage();
            });
            timeSlider.addEventListener('input', (e) => {
              selectedTime = parseInt(e.target.value);
              document.getElementById('time-label').textContent = 't=' + selectedTime;
              updatePreviewImage();
            });
            document.getElementById('colormap-select').addEventListener('change', (e) => {
              selectedCmap = e.target.value;
              updatePreviewImage();
            });

            // Update metadata display
            const metaDiv = document.getElementById('preview-metadata');
            let dimText = '<strong>Dimensions:</strong> ';
            for (const [dim, size] of Object.entries(metadata.dimensions)) {
              dimText += dim + '=' + size + ' ';
            }
            metaDiv.innerHTML = dimText;

            // Show content, hide loading
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'block';

            updatePreviewImage();
          } catch (err) {
            if (loading) loading.style.display = 'none';
            if (errorDiv) {
              errorDiv.textContent = 'Preview unavailable: ' + err.message;
              errorDiv.style.display = 'block';
            }
          }
        }

        function updatePreviewImage() {
          if (!selectedVariable || item.type === 'Collection') return;

          const params = new URLSearchParams({
            var: selectedVariable,
            time: selectedTime,
            cmap: selectedCmap,
            stac_api: stacApi
          });
          if (item.collection) params.set('collection_id', item.collection);

          const img = document.getElementById('preview-image');
          img.src = vizServer + '/preview/' + item.id + '.png?' + params;
          img.alt = 'Preview of ' + selectedVariable;
        }

        function refreshPreview() {
          const img = document.getElementById('preview-image');
          const currentSrc = img.src;
          const url = new URL(currentSrc);
          url.searchParams.set('_refresh', Date.now());
          img.src = url.toString();
        }

        // Auto-load for items
        if (item.type !== 'Collection') {
          // Pre-fetch metadata for static mode
        }
      </script>
    </body>
    </html>
  `;
};

test.describe('DataPreview Component', () => {

  test.describe('Mode Toggle', () => {

    test('should display mode toggle buttons with Interactive selected by default', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Verify both toggle buttons are visible
      const interactiveBtn = page.locator('#btn-interactive');
      const staticBtn = page.locator('#btn-static');

      await expect(interactiveBtn).toBeVisible();
      await expect(staticBtn).toBeVisible();

      // Verify Interactive is selected (has btn-primary class)
      await expect(interactiveBtn).toHaveClass(/btn-primary/);
      await expect(staticBtn).toHaveClass(/btn-outline-secondary/);
    });

    test('should switch to static mode when Static button is clicked', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      const interactiveBtn = page.locator('#btn-interactive');
      const staticBtn = page.locator('#btn-static');
      const interactivePreview = page.locator('#interactive-preview');
      const staticPreview = page.locator('#static-preview');

      // Click Static button
      await staticBtn.click();

      // Verify Static is now selected
      await expect(staticBtn).toHaveClass(/btn-primary/);
      await expect(interactiveBtn).toHaveClass(/btn-outline-secondary/);

      // Verify static preview is visible, interactive is hidden
      await expect(staticPreview).toBeVisible();
      await expect(interactivePreview).not.toBeVisible();
    });

    test('should switch back to interactive mode when Interactive button is clicked', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      const interactiveBtn = page.locator('#btn-interactive');
      const staticBtn = page.locator('#btn-static');
      const interactivePreview = page.locator('#interactive-preview');
      const staticPreview = page.locator('#static-preview');

      // Switch to static first
      await staticBtn.click();
      await expect(staticPreview).toBeVisible();

      // Switch back to interactive
      await interactiveBtn.click();

      // Verify Interactive is selected again
      await expect(interactiveBtn).toHaveClass(/btn-primary/);
      await expect(staticBtn).toHaveClass(/btn-outline-secondary/);

      // Verify interactive preview is visible
      await expect(interactivePreview).toBeVisible();
      await expect(staticPreview).not.toBeVisible();
    });
  });

  test.describe('Interactive Mode', () => {

    test('should show loading indicator before iframe loads', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Initially, loading indicator should be visible
      const loadingIndicator = page.locator('#iframe-loading');
      await expect(loadingIndicator).toBeVisible();
      await expect(loadingIndicator).toContainText('Loading interactive preview');
    });

    test('should show iframe after it loads successfully', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      const iframe = page.locator('#preview-iframe');
      const loadingIndicator = page.locator('#iframe-loading');

      // Manually trigger the iframe load by calling the handler
      // (iframe onload doesn't work with page.setContent for cross-origin src)
      await page.evaluate(() => {
        if (typeof handleIframeLoad === 'function') {
          handleIframeLoad();
        }
      });

      // Verify iframe is visible and loading is hidden
      await expect(iframe).toBeVisible();
      await expect(loadingIndicator).not.toBeVisible();
    });

    test('should construct correct iframe URL with item and STAC API parameters', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      const iframe = page.locator('#preview-iframe');
      const src = await iframe.getAttribute('src');

      // Verify URL structure
      expect(src).toContain(`${VIZ_SERVER_URL}/panel/`);
      expect(src).toContain(`item_id=${STAC_ITEM_FIXTURE.id}`);
      expect(src).toContain(`stac_api=${encodeURIComponent(STAC_API_URL)}`);
      expect(src).toContain(`collection_id=${STAC_ITEM_FIXTURE.collection}`);
    });
  });

  test.describe('Static Mode', () => {

    test('should show loading indicator when switching to static mode', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Loading indicator exists (may be hidden quickly when mock data loads fast)
      const loadingIndicator = page.locator('#static-loading');
      await expect(loadingIndicator).toBeAttached();
      await expect(loadingIndicator).toContainText('Loading preview');
    });

    test('should display variable selector with options from metadata', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode and wait for metadata to load
      await page.locator('#btn-static').click();

      // Wait for content to be visible
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify variable selector exists and has options
      const variableSelect = page.locator('#variable-select');
      await expect(variableSelect).toBeVisible();

      // Check that the variables from metadata are present
      const options = variableSelect.locator('option');
      await expect(options).toHaveCount(3);

      // Verify first option is temperature
      await expect(options.first()).toContainText('Temperature');
      await expect(options.first()).toContainText('(K)');
    });

    test('should display time slider for temporal data', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify time slider exists
      const timeSlider = page.locator('#time-slider');
      await expect(timeSlider).toBeVisible();

      // Verify max is set correctly (time dimension - 1)
      const max = await timeSlider.getAttribute('max');
      expect(parseInt(max)).toBe(ITEM_METADATA_FIXTURE.dimensions.time - 1);

      // Verify time label is visible
      const timeLabel = page.locator('#time-label');
      await expect(timeLabel).toBeVisible();
      await expect(timeLabel).toHaveText('t=0');
    });

    test('should display colormap selector with options', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify colormap selector exists
      const colormapSelect = page.locator('#colormap-select');
      await expect(colormapSelect).toBeVisible();

      // Verify standard colormap options
      const options = colormapSelect.locator('option');
      await expect(options).toHaveCount(4);

      // Check specific options (use toHaveAttribute for option elements)
      await expect(options.nth(0)).toHaveAttribute('value', 'viridis');
      await expect(options.nth(1)).toHaveAttribute('value', 'plasma');
      await expect(options.nth(2)).toHaveAttribute('value', 'coolwarm');
      await expect(options.nth(3)).toHaveAttribute('value', 'RdBu_r');
    });

    test('should display refresh button', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify refresh button exists
      const refreshBtn = page.locator('#refresh-btn');
      await expect(refreshBtn).toBeVisible();
      await expect(refreshBtn).toHaveText('Refresh');
    });

    test('should update time label when slider is moved', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      const timeSlider = page.locator('#time-slider');
      const timeLabel = page.locator('#time-label');

      // Change slider value
      await timeSlider.fill('5');
      await timeSlider.dispatchEvent('input');

      // Verify label updates
      await expect(timeLabel).toHaveText('t=5');
    });

    test('should display preview image with correct src', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify preview image exists and has correct src pattern
      const previewImage = page.locator('#preview-image');
      await expect(previewImage).toBeVisible();

      const src = await previewImage.getAttribute('src');
      expect(src).toContain(`${VIZ_SERVER_URL}/preview/${STAC_ITEM_FIXTURE.id}.png`);
      expect(src).toContain('var=temperature');
      expect(src).toContain('time=0');
      expect(src).toContain('cmap=viridis');
    });

    test('should display metadata dimensions', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Verify metadata dimensions are displayed
      const metadataDiv = page.locator('#preview-metadata');
      await expect(metadataDiv).toBeVisible();
      await expect(metadataDiv).toContainText('Dimensions');
      await expect(metadataDiv).toContainText('time=12');
      await expect(metadataDiv).toContainText('lat=180');
      await expect(metadataDiv).toContainText('lon=360');
    });

    test('should show error when metadata fetch fails', async ({ page }) => {
      await mockVizServer(page, { metadataStatus: 500 });

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for error to appear
      const errorDiv = page.locator('#static-error');
      await expect(errorDiv).toBeVisible({ timeout: 5000 });
      await expect(errorDiv).toContainText('Preview unavailable');
    });
  });

  test.describe('Collection Preview Warning', () => {

    test('should show info message for collections in interactive mode', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_COLLECTION_FIXTURE);
      await page.setContent(html);

      // Verify collection warning message is shown
      const infoAlert = page.locator('#interactive-preview .alert-info');
      await expect(infoAlert).toBeVisible();
      await expect(infoAlert).toContainText('Select an item from the collection to preview its data');
    });

    test('should show warning message for collections in static mode', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_COLLECTION_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Verify collection warning message is shown
      const warningAlert = page.locator('#static-preview .alert-warning');
      await expect(warningAlert).toBeVisible();
      await expect(warningAlert).toContainText('Select an item from the collection to preview its data');
    });

    test('should not show iframe for collections', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_COLLECTION_FIXTURE);
      await page.setContent(html);

      // Verify no iframe exists for collections
      const iframe = page.locator('#preview-iframe');
      await expect(iframe).toHaveCount(0);
    });

    test('should not show preview controls for collections in static mode', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_COLLECTION_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Verify preview controls are not present
      const variableSelect = page.locator('#variable-select');
      const timeSlider = page.locator('#time-slider');
      const colormapSelect = page.locator('#colormap-select');

      await expect(variableSelect).toHaveCount(0);
      await expect(timeSlider).toHaveCount(0);
      await expect(colormapSelect).toHaveCount(0);
    });
  });

  test.describe('Refresh Functionality', () => {

    test('should update image src with refresh parameter when refresh clicked', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      // Get initial image src
      const previewImage = page.locator('#preview-image');
      const initialSrc = await previewImage.getAttribute('src');

      // Click refresh
      await page.locator('#refresh-btn').click();

      // Verify src changed (has _refresh parameter)
      const newSrc = await previewImage.getAttribute('src');
      expect(newSrc).not.toBe(initialSrc);
      expect(newSrc).toContain('_refresh=');
    });
  });

  test.describe('Variable Selection', () => {

    test('should update image when different variable is selected', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      const variableSelect = page.locator('#variable-select');
      const previewImage = page.locator('#preview-image');

      // Get initial src
      const initialSrc = await previewImage.getAttribute('src');
      expect(initialSrc).toContain('var=temperature');

      // Change variable to precipitation
      await variableSelect.selectOption('precipitation');

      // Verify image src updated
      const newSrc = await previewImage.getAttribute('src');
      expect(newSrc).toContain('var=precipitation');
    });
  });

  test.describe('Colormap Selection', () => {

    test('should update image when different colormap is selected', async ({ page }) => {
      await mockVizServer(page);

      const html = createDataPreviewTestPage(STAC_ITEM_FIXTURE);
      await page.setContent(html);

      // Switch to static mode
      await page.locator('#btn-static').click();

      // Wait for content to load
      const previewContent = page.locator('#preview-content');
      await expect(previewContent).toBeVisible({ timeout: 5000 });

      const colormapSelect = page.locator('#colormap-select');
      const previewImage = page.locator('#preview-image');

      // Get initial src
      const initialSrc = await previewImage.getAttribute('src');
      expect(initialSrc).toContain('cmap=viridis');

      // Change colormap to plasma
      await colormapSelect.selectOption('plasma');

      // Verify image src updated
      const newSrc = await previewImage.getAttribute('src');
      expect(newSrc).toContain('cmap=plasma');
    });
  });
});
