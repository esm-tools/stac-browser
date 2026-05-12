<template>
  <b-modal
    v-model="isOpen"
    size="xl"
    title="Collection Comparison"
    scrollable
    @hidden="closeComparison"
  >
    <div v-if="loading" class="text-center py-4">
      <b-spinner label="Loading..." />
    </div>

    <div v-else-if="collections.length === 0" class="text-center py-4 text-muted">
      No collections selected for comparison.
    </div>

    <div v-else class="comparison-container">
      <!-- Tab navigation -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <a
            class="nav-link"
            :class="{ active: activeTab === 'parameters' }"
            href="#"
            @click.prevent="activeTab = 'parameters'"
          >Parameters</a>
        </li>
        <li class="nav-item">
          <a
            class="nav-link"
            :class="{ active: activeTab === 'visual' }"
            href="#"
            @click.prevent="activeTab = 'visual'"
          >Visual Compare</a>
        </li>
      </ul>

      <!-- Parameters tab -->
      <div v-if="activeTab === 'parameters'">
        <div class="comparison-controls mb-3 d-flex gap-2 align-items-center">
          <b-form-checkbox v-model="showOnlyDifferences" switch>
            Show only differences
          </b-form-checkbox>
          <b-form-input
            v-model="parameterFilter"
            type="text"
            size="sm"
            placeholder="Filter parameters..."
            style="max-width: 200px"
          />
        </div>

        <div class="table-responsive">
          <table class="table table-sm table-bordered comparison-table">
            <thead class="table-light">
              <tr>
                <th class="param-header">Parameter</th>
                <th v-for="col in collections" :key="col.id" class="collection-header">
                  <div class="collection-title">{{ col.title || col.id }}</div>
                  <small class="text-muted">{{ col.id }}</small>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="param in filteredParameters"
                :key="param"
                :class="{ 'table-warning': hasDifference(param) }"
              >
                <td class="param-name">
                  <code>{{ formatParamName(param) }}</code>
                </td>
                <td v-for="col in collections" :key="col.id" class="param-value">
                  {{ formatValue(getParamValue(col.id, param)) }}
                </td>
              </tr>
              <tr v-if="filteredParameters.length === 0">
                <td :colspan="collections.length + 1" class="text-center text-muted py-3">
                  No matching parameters found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Visual Compare tab -->
      <div v-if="activeTab === 'visual'">
        <div v-if="collections.length >= 2" class="visual-compare">
          <div class="mb-2 small text-muted">
            Comparing <strong>{{ collections[0].title || collections[0].id }}</strong>
            vs <strong>{{ collections[1].title || collections[1].id }}</strong>
            -- side-by-side spatial plots with difference view
          </div>
          <iframe
            :src="visualCompareUrl"
            class="compare-iframe"
            @load="iframeLoading = false"
          />
          <div v-if="iframeLoading" class="text-center py-4">
            <b-spinner /> Loading visual comparison...
          </div>
        </div>
        <div v-else class="alert alert-info">
          Select at least 2 collections to use visual comparison.
        </div>
      </div>
    </div>

    <template #footer>
      <b-button variant="secondary" @click="closeComparison">Cancel</b-button>
      <b-button variant="primary" @click="closeComparison">OK</b-button>
    </template>
  </b-modal>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import { BModal, BButton, BSpinner, BFormCheckbox, BFormInput } from 'bootstrap-vue-next';

export default {
  name: 'CollectionComparison',
  components: {
    BModal, BButton, BSpinner, BFormCheckbox, BFormInput
  },
  data() {
    return {
      activeTab: 'parameters',
      showOnlyDifferences: false,
      parameterFilter: '',
      loading: false,
      iframeLoading: true
    };
  },
  computed: {
    ...mapState('comparison', ['isModalOpen', 'selectedCollections', 'collectionData']),
    ...mapGetters('comparison', ['allParameters', 'getParamValue', 'hasDifference']),
    ...mapState(['catalogUrl', 'vizServer']),
    isOpen: {
      get() {
        return this.isModalOpen;
      },
      set(value) {
        if (!value) {
          this.closeComparison();
        }
      }
    },
    collections() {
      return this.selectedCollections.map(id => {
        const data = this.collectionData[id] || {};
        return {
          id,
          title: data.title || data.properties?.title || id,
          ...data
        };
      });
    },
    filteredParameters() {
      let params = this.allParameters;
      if (this.showOnlyDifferences) {
        params = params.filter(p => this.hasDifference(p));
      }
      if (this.parameterFilter) {
        const filter = this.parameterFilter.toLowerCase();
        params = params.filter(p => p.toLowerCase().includes(filter));
      }
      return params;
    },
    visualCompareUrl() {
      if (this.collections.length < 2 || !this.vizServer) return null;
      const params = new URLSearchParams({
        collection_a: this.collections[0].id,
        collection_b: this.collections[1].id,
        stac_api: this.catalogUrl || ''
      });
      return `${this.vizServer}/preview/compare/panel?${params}`;
    }
  },
  watch: {
    isModalOpen(isOpen) {
      if (isOpen) {
        this.loadCollectionData();
        this.iframeLoading = true;
      }
    },
    activeTab(tab) {
      if (tab === 'visual') {
        this.iframeLoading = true;
      }
    }
  },
  methods: {
    ...mapActions('comparison', ['closeComparison']),
    async loadCollectionData() {
      this.loading = true;
      try {
        const stacApi = this.catalogUrl || '';
        for (const id of this.selectedCollections) {
          if (!this.collectionData[id]) {
            // Fetch collection metadata from the STAC API (for title, etc.)
            try {
              const resp = await fetch(`${stacApi}/collections/${id}`);
              if (resp.ok) {
                const collData = await resp.json();
                this.$store.commit('comparison/setCollectionData', {
                  collectionId: id,
                  data: collData
                });
              }
            } catch (e) {
              console.warn('Failed to fetch collection metadata for', id, e);
            }
            // Fetch items to get namelist parameters (nml: prefixed item properties)
            await this.fetchItemParameters(id, stacApi);
          }
        }
      } finally {
        this.loading = false;
      }
    },
    async fetchItemParameters(collectionId, stacApi) {
      try {
        const response = await fetch(`${stacApi}/collections/${collectionId}/items?limit=1`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const item = data.features[0];
          const props = item.properties || {};
          // Merge item properties (which have nml: keys) into collection data
          const existing = this.collectionData[collectionId] || {};
          this.$store.commit('comparison/setCollectionData', {
            collectionId,
            data: { ...existing, ...props }
          });
        }
      } catch (e) {
        console.warn('Failed to fetch item parameters for', collectionId, e);
      }
    },
    formatParamName(param) {
      if (param.startsWith('nml:')) {
        return param.substring(4);
      }
      return param;
    },
    formatValue(value) {
      if (value === null || value === undefined) {
        return '-';
      }
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      if (typeof value === 'number') {
        if (Math.abs(value) < 0.001 && value !== 0) {
          return value.toExponential(4);
        }
        if (Math.abs(value) > 1e6) {
          return value.toExponential(4);
        }
        return value.toString();
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    }
  }
};
</script>

<style lang="scss" scoped>
.comparison-container {
  max-height: 75vh;
}

.compare-iframe {
  width: 100%;
  height: 600px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.comparison-table {
  font-size: 0.875rem;

  .param-header {
    min-width: 200px;
    position: sticky;
    left: 0;
    background: #f8f9fa;
    z-index: 1;
  }

  .collection-header {
    min-width: 180px;
    text-align: center;
    vertical-align: top;

    .collection-title {
      font-weight: 600;
      word-break: break-word;
    }
  }

  .param-name {
    font-family: monospace;
    font-size: 0.8rem;
    white-space: nowrap;
    position: sticky;
    left: 0;
    background: white;

    code {
      color: #495057;
    }
  }

  .param-value {
    text-align: center;
    font-family: monospace;
    font-size: 0.8rem;
  }

  tr.table-warning {
    .param-name {
      background: #fff3cd;
    }
  }
}
</style>
