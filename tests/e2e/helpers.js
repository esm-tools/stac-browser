import { expect } from "@playwright/test";

export const HOME_PATH = "/";
export const SEARCH_PATH = "/search/external/earth-search.aws.test.com/v1?.language=en";

const SEARCH_API_URL = "https://earth-search.aws.test.com/v1/search";

const API_ROOT_URL = "https://earth-search.aws.test.com/v1";
const API_COLLECTIONS_URL = "https://earth-search.aws.test.com/v1/collections";

// todo: Move STAC documents to separate files
const API_QUERYABLES_URL = "https://earth-search.aws.test.com/v1/queryables";

const API_ROOT_FIXTURE = {
  stac_version: "1.0.0",
  id: "test-api",
  title: "Test API",
  description: "Test API root",
  conformsTo: [
    "https://api.stacspec.org/v1.0.0/core",
    "https://api.stacspec.org/v1.0.0/item-search",
    "https://api.stacspec.org/v1.0.0/item-search#sort",
    "https://api.stacspec.org/v1.0.0/item-search#filter",  // Required for CQL filters in item search
    "https://api.stacspec.org/v1.0.0/collection-search",
    "https://api.stacspec.org/v1.0.0/collection-search#filter",  // Required for CQL filters in collection search
    // CQL2 conformances - required for Quick Filters to appear
    "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter",
    "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/features-filter",
    "http://www.opengis.net/spec/cql2/1.0/conf/cql2-text",
    "http://www.opengis.net/spec/cql2/1.0/conf/cql2-json",
    "http://www.opengis.net/spec/cql2/1.0/conf/basic-cql2",
  ],
  links: [
    {
      rel: "self",
      type: "application/json",
      href: API_ROOT_URL,
    },
    {
      rel: "search",
      type: "application/geo+json",
      href: SEARCH_API_URL,
      method: "POST",
    },
    {
      rel: "collections",
      type: "application/json",
      href: API_COLLECTIONS_URL,
    },
    {
      rel: "http://www.opengis.net/def/rel/ogc/1.0/queryables",
      type: "application/schema+json",
      title: "Queryables",
      href: API_QUERYABLES_URL,
    },
  ],
};

const API_COLLECTIONS_FIXTURE = {
  collections: [
    {
      type: "Collection",
      id: "test-collection-1",
      title: "Test Collection 1",
      description: "Test collection 1",
      stac_version: "1.0.0",
      extent: {
        spatial: { bbox: [[-180, -90, 180, 90]] },
        temporal: { interval: [["2020-01-01T00:00:00Z", null]] },
      },
      links: [
        {
          rel: "self",
          type: "application/json",
          href: `${API_COLLECTIONS_URL}/test-collection-1`,
        },
      ],
    },
    {
      type: "Collection",
      id: "test-collection-2",
      title: "Test Collection 2",
      description: "Test collection 2",
      stac_version: "1.0.0",
      extent: {
        spatial: { bbox: [[-10, -10, 10, 10]] },
        temporal: { interval: [["2021-01-01T00:00:00Z", null]] },
      },
      links: [
        {
          rel: "self",
          type: "application/json",
          href: `${API_COLLECTIONS_URL}/test-collection-2`,
        },
      ],
    },
  ],
  links: [
    {
      rel: "self",
      type: "application/json",
      href: API_COLLECTIONS_URL,
    },
    {
      rel: "root",
      type: "application/json",
      href: API_ROOT_URL,
    },
    {
      rel: "http://www.opengis.net/def/rel/ogc/1.0/queryables",
      type: "application/schema+json",
      title: "Queryables",
      href: API_QUERYABLES_URL,
    },
  ],
  context: {
    page: 1,
    limit: 2,
    matched: 2,
    returned: 2,
  },
};

export const mockApiRootAndCollections = async (page) => {
  await page.route(API_ROOT_URL, async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(API_ROOT_FIXTURE),
      });
      return;
    }
    await route.continue();
  });

  await page.route(API_COLLECTIONS_URL, async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(API_COLLECTIONS_FIXTURE),
      });
      return;
    }
    await route.continue();
  });
};

// NOTE: waitForMapReady and waitForBboxInputsPopulated removed
// Spatial extent filtering not used - all climate models are global

export const waitForSearchPost = async (page, responseBody = null) => {
  let handler;
  const requestPromise = new Promise((resolve) => {
    handler = async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        resolve({
          request,
          body: request.postDataJSON(),
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            responseBody || {
              type: "FeatureCollection",
              features: [],
              links: [],
            },
          ),
        });
        await page.unroute(SEARCH_API_URL, handler);
        return;
      }
      await route.continue();
    };
  });

  await page.route(SEARCH_API_URL, handler);
  return requestPromise;
};
