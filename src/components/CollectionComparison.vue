<template>
  <b-modal
    v-model="isOpen"
    size="xl"
    title="Collection Comparison"
    hide-footer
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
      <!-- Filter controls -->
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

      <!-- Comparison table -->
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
  </b-modal>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import { BModal } from 'bootstrap-vue-next';

export default {
  name: 'CollectionComparison',
  components: {
    BModal
  },
  data() {
    return {
      showOnlyDifferences: false,
      parameterFilter: '',
      loading: false
    };
  },
  computed: {
    ...mapState('comparison', ['isModalOpen', 'selectedCollections', 'collectionData']),
    ...mapGetters('comparison', ['allParameters', 'getParamValue', 'hasDifference']),
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
    // Get collection objects with their data
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
    // Filtered parameters based on user controls
    filteredParameters() {
      let params = this.allParameters;

      // Filter to only differences if requested
      if (this.showOnlyDifferences) {
        params = params.filter(p => this.hasDifference(p));
      }

      // Apply text filter
      if (this.parameterFilter) {
        const filter = this.parameterFilter.toLowerCase();
        params = params.filter(p => p.toLowerCase().includes(filter));
      }

      return params;
    }
  },
  watch: {
    isModalOpen(isOpen) {
      if (isOpen) {
        this.loadCollectionData();
      }
    }
  },
  methods: {
    ...mapActions('comparison', ['closeComparison']),
    async loadCollectionData() {
      this.loading = true;
      try {
        // Fetch data for each collection from the store's database
        for (const id of this.selectedCollections) {
          if (!this.collectionData[id]) {
            // Try to get from the global database
            const stacData = this.$store.state.database[id];
            if (stacData && typeof stacData === 'object') {
              this.$store.commit('comparison/setCollectionData', {
                collectionId: id,
                data: stacData
              });
            }
          }
        }
      } finally {
        this.loading = false;
      }
    },
    // Format parameter name for display
    formatParamName(param) {
      // Remove nml: prefix and format nicely
      if (param.startsWith('nml:')) {
        return param.substring(4);
      }
      return param;
    },
    // Format value for display
    formatValue(value) {
      if (value === null || value === undefined) {
        return '-';
      }
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      if (typeof value === 'number') {
        // Format scientific notation for very small/large numbers
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
  max-height: 70vh;
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
