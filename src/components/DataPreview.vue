<template>
  <div class="data-preview">
    <!-- Loading state -->
    <div v-if="loading" class="text-center p-4">
      <b-spinner /> Loading preview...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="alert alert-warning">
      {{ error }}
    </div>

    <!-- Preview content -->
    <div v-else class="preview-content">
      <!-- Controls row -->
      <div class="preview-controls mb-3 d-flex gap-2 flex-wrap">
        <select v-model="selectedVariable" class="form-select form-select-sm" style="width: auto;">
          <option v-for="v in variables" :key="v.name" :value="v.name">
            {{ v.long_name || v.name }} {{ v.units ? `(${v.units})` : '' }}
          </option>
        </select>

        <input
          v-if="timeMax > 0"
          type="range"
          v-model.number="selectedTime"
          :max="timeMax"
          min="0"
          class="form-range"
          style="width: 150px;"
        />
        <span v-if="timeMax > 0" class="small">t={{ selectedTime }}</span>

        <select v-model="selectedCmap" class="form-select form-select-sm" style="width: auto;">
          <option value="viridis">Viridis</option>
          <option value="plasma">Plasma</option>
          <option value="coolwarm">Coolwarm</option>
          <option value="RdBu_r">Red-Blue</option>
        </select>

        <button @click="refreshPreview" class="btn btn-sm btn-outline-secondary">
          Refresh
        </button>
      </div>

      <!-- Image preview -->
      <div class="preview-image text-center">
        <img
          v-if="previewUrl"
          :src="previewUrl"
          :alt="`Preview of ${selectedVariable}`"
          class="img-fluid border"
          @load="imageLoading = false"
          @error="handleImageError"
        />
      </div>

      <!-- Metadata summary -->
      <div v-if="metadata" class="preview-metadata mt-3 small text-muted">
        <strong>Dimensions:</strong>
        <span v-for="(size, dim) in metadata.dimensions" :key="dim" class="me-2">
          {{ dim }}={{ size }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { BSpinner } from 'bootstrap-vue-next';

export default defineComponent({
  name: 'DataPreview',
  components: {
    BSpinner
  },
  props: {
    item: {
      type: Object,
      required: true
    },
    vizServer: {
      type: String,
      default: 'http://localhost:8001'
    },
    stacApi: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      error: null,
      metadata: null,
      variables: [],
      selectedVariable: null,
      selectedTime: 0,
      selectedCmap: 'viridis',
      timeMax: 0,
      imageLoading: false,
      refreshKey: 0
    };
  },
  computed: {
    previewUrl() {
      if (!this.selectedVariable || !this.item?.id) return null;
      const params = new URLSearchParams({
        var: this.selectedVariable,
        time: this.selectedTime,
        cmap: this.selectedCmap,
        stac_api: this.stacApi,
        _refresh: this.refreshKey
      });
      return `${this.vizServer}/preview/${this.item.id}.png?${params}`;
    }
  },
  watch: {
    item: {
      immediate: true,
      handler() {
        this.fetchMetadata();
      }
    }
  },
  methods: {
    async fetchMetadata() {
      if (!this.item?.id) return;

      this.loading = true;
      this.error = null;

      try {
        const params = new URLSearchParams({ stac_api: this.stacApi });
        const response = await fetch(
          `${this.vizServer}/preview/${this.item.id}.json?${params}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load metadata: ${response.statusText}`);
        }

        this.metadata = await response.json();
        this.variables = this.metadata.variables || [];

        if (this.variables.length > 0) {
          this.selectedVariable = this.variables[0].name;
        }

        // Set time dimension max
        const timeDim = this.metadata.dimensions?.time ||
                        this.metadata.dimensions?.Time || 0;
        this.timeMax = Math.max(0, timeDim - 1);

      } catch (err) {
        this.error = `Preview unavailable: ${err.message}`;
      } finally {
        this.loading = false;
      }
    },
    refreshPreview() {
      // Force image reload by incrementing refresh key
      this.refreshKey++;
      this.imageLoading = true;
    },
    handleImageError() {
      this.error = 'Failed to load preview image. Is the visualization server running?';
    }
  }
});
</script>

<style scoped>
.data-preview {
  padding: 1rem;
}
.preview-image img {
  max-height: 500px;
}
.preview-controls {
  align-items: center;
}
</style>
