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

        <div class="ag-theme-alpine comparison-grid">
          <AgGridVue
            :columnDefs="columnDefs"
            :rowData="gridRowData"
            :rowClassRules="rowClassRules"
            :defaultColDef="defaultColDef"
            :headerHeight="40"
            domLayout="autoHeight"
            suppressCellFocus
            @grid-ready="onGridReady"
          />
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
import { AgGridVue } from 'ag-grid-vue3';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

const HEADER_COLORS = ['#0d6efd', '#fd7e14', '#198754', '#6f42c1', '#d63384'];

export default {
  name: 'CollectionComparison',
  components: {
    BModal, BButton, BSpinner, BFormCheckbox, BFormInput, AgGridVue
  },
  data() {
    return {
      activeTab: 'parameters',
      showOnlyDifferences: false,
      parameterFilter: '',
      loading: false,
      iframeLoading: true,
      gridApi: null,
    };
  },
  computed: {
    ...mapState('comparison', ['isModalOpen', 'selectedCollections', 'collectionData']),
    ...mapGetters('comparison', ['allParameters', 'getParamValue', 'hasDifference']),
    ...mapState(['catalogUrl', 'vizServer']),
    isOpen: {
      get() { return this.isModalOpen; },
      set(value) { if (!value) this.closeComparison(); }
    },
    collections() {
      return this.selectedCollections.map(id => {
        const data = this.collectionData[id] || {};
        return { id, title: data.title || data.properties?.title || id, ...data };
      });
    },
    filteredParameters() {
      let params = this.allParameters;
      if (this.showOnlyDifferences) params = params.filter(p => this.hasDifference(p));
      if (this.parameterFilter) {
        const filter = this.parameterFilter.toLowerCase();
        params = params.filter(p => p.toLowerCase().includes(filter));
      }
      return params;
    },
    defaultColDef() {
      return {
        resizable: true,
        sortable: true,
        minWidth: 120,
      };
    },
    columnDefs() {
      const cols = [
        {
          field: 'param',
          headerName: 'Parameter',
          pinned: 'left',
          width: 240,
          resizable: true,
          cellStyle: {
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: '#495057',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
      ];
      this.collections.forEach((col, idx) => {
        cols.push({
          field: col.id,
          headerName: col.id,
          flex: 1,
          minWidth: 150,
          resizable: true,
          wrapText: true,
          autoHeight: true,
          cellStyle: {
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            textAlign: 'center',
            lineHeight: '1.4',
            paddingTop: '8px',
            paddingBottom: '8px',
            wordBreak: 'break-all',
          },
          headerStyle: { borderTop: `3px solid ${HEADER_COLORS[idx % HEADER_COLORS.length]}` },
        });
      });
      return cols;
    },
    gridRowData() {
      return this.filteredParameters.map(param => {
        const row = { param: this.formatParamName(param), _rawParam: param };
        this.collections.forEach(col => {
          row[col.id] = this.formatValue(this.getParamValue(col.id, param));
        });
        return row;
      });
    },
    rowClassRules() {
      return {
        'row-diff': params => params.data && this.hasDifference(params.data._rawParam),
      };
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
      if (isOpen) { this.loadCollectionData(); this.iframeLoading = true; }
    },
    activeTab(tab) {
      if (tab === 'visual') this.iframeLoading = true;
    },
    gridRowData() {
      if (this.gridApi) this.gridApi.sizeColumnsToFit();
    },
  },
  methods: {
    ...mapActions('comparison', ['closeComparison']),
    onGridReady(params) {
      this.gridApi = params.api;
      params.api.sizeColumnsToFit();
    },
    async loadCollectionData() {
      this.loading = true;
      try {
        const stacApi = this.catalogUrl || '';
        for (const id of this.selectedCollections) {
          if (!this.collectionData[id]) {
            try {
              const resp = await fetch(`${stacApi}/collections/${id}`);
              if (resp.ok) {
                const collData = await resp.json();
                this.$store.commit('comparison/setCollectionData', { collectionId: id, data: collData });
              }
            } catch (e) {
              console.warn('Failed to fetch collection metadata for', id, e);
            }
            await this.fetchItemParameters(id, stacApi);
          }
        }
      } finally {
        this.loading = false;
      }
    },
    async fetchItemParameters(collectionId, stacApi) {
      try {
        const response = await fetch(`${stacApi}/collections/${collectionId}/items?limit=50`);
        if (!response.ok) return;
        const data = await response.json();
        if (!data.features || data.features.length === 0) return;
        const nmlItem = data.features.find(f =>
          Object.keys(f.properties || {}).some(k => k.startsWith('nml:'))
        ) || data.features[0];
        const props = nmlItem.properties || {};
        const existing = this.collectionData[collectionId] || {};
        this.$store.commit('comparison/setCollectionData', {
          collectionId,
          data: { ...existing, ...props }
        });
      } catch (e) {
        console.warn('Failed to fetch item parameters for', collectionId, e);
      }
    },
    formatParamName(param) {
      return param.startsWith('nml:') ? param.substring(4) : param;
    },
    formatValue(value) {
      if (value === null || value === undefined) return '-';
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') {
        if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(4);
        if (Math.abs(value) > 1e6) return value.toExponential(4);
        return value.toString();
      }
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
  }
};
</script>

<style lang="scss" scoped>
.comparison-container {
  max-height: 75vh;
  overflow-y: auto;
}

.compare-iframe {
  width: 100%;
  height: 600px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.comparison-grid {
  width: 100%;
  font-size: 0.875rem;
}
</style>

<style>
/* AG Grid row highlight for differences (unscoped — needs to reach inside ag-grid shadow) */
.ag-theme-alpine .ag-row.row-diff {
  background-color: #fff3cd !important;
}
.ag-theme-alpine .ag-row.row-diff.ag-row-hover {
  background-color: #ffe69c !important;
}
</style>
