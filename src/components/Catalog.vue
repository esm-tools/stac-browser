<template>
  <b-card no-body :class="classes" v-visible.400="load" :img-placement="isList ? 'end' : undefined">
    <div class="card-img-wrapper">
      <b-card-img v-if="hasImage" class="thumbnail" v-bind="thumbnail" lazy />
    </div>
    <b-card-body>
      <b-card-title class="d-flex justify-content-between align-items-start">
        <StacLink :data="[data, catalog]" class="stretched-link" />
        <!-- Right-side header: Compare badge + Add to Collection star -->
        <div class="card-header-actions ms-2 flex-shrink-0">
          <b-button
            v-if="canCompare"
            size="sm"
            :variant="isSelectedForComparison ? 'secondary' : 'outline-secondary'"
            class="compare-badge ms-1"
            @click.stop="toggleComparison"
          >Compare</b-button>
          <AddToCollection v-if="collectionId" :item-id="collectionId" :compact="true" class="ms-1" />
        </div>
      </b-card-title>
      <!-- Model component badges on their own row below the title -->
      <div v-if="modelComponents.length > 0" class="model-badges mb-1">
        <b-badge
          v-for="comp in modelComponents"
          :key="comp"
          :variant="componentVariant(comp)"
          class="me-1"
        >{{ comp }}</b-badge>
      </div>
      <b-card-text v-if="fileFormats.length > 0 || hasDescription || isDeprecated" class="intro">
        <b-badge v-if="isDeprecated" variant="warning" class="me-1 mt-1 deprecated">{{ $t('deprecated') }}</b-badge>
        <b-badge v-for="format in fileFormats" :key="format" variant="secondary" class="me-1 mt-1 fileformat">{{ format }}</b-badge>
        {{ summarizeDescription }}
      </b-card-text>
      <!-- Climate scientist quick facts row -->
      <b-card-text v-if="hasQuickFacts" class="quick-facts small text-muted mb-2">
        <span v-if="paleoDisplay" class="me-3">
          <b-badge variant="info">{{ paleoDisplay }}</b-badge>
        </span>
        <span v-if="co2Display" class="me-3">CO2: {{ co2Display }}</span>
        <span v-if="runLength" class="me-3">{{ runLength }}</span>
        <span v-if="resolution" class="me-3">
          <GlossaryTooltip :term="resolution">{{ resolution }}</GlossaryTooltip>
        </span>
        <span v-if="dataVolume" class="me-3">{{ dataVolume }}</span>
      </b-card-text>
      <!-- DOI/Citation display -->
      <div v-if="doi" class="doi-citation mb-2 d-flex align-items-center gap-2">
        <a :href="doiUrl" target="_blank" rel="noopener" class="doi-link" @click.stop>
          <b-badge variant="success">DOI</b-badge>
        </a>
        <b-button size="sm" variant="outline-secondary" class="cite-btn" @click.stop="copyCitation">
          Cite
        </b-button>
      </div>
      <Keywords v-if="showKeywordsInCatalogCards && keywords.length > 0" :keywords="keywords" variant="primary" />
      <b-card-text v-if="temporalExtent" class="datetime"><small v-html="temporalExtent" /></b-card-text>
    </b-card-body>
    <b-card-footer>
      <slot name="footer" :data="data" />
    </b-card-footer>
  </b-card>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import { mapState, mapGetters } from 'vuex';
import FileFormatsMixin from './FileFormatsMixin';
import StacFieldsMixin from './StacFieldsMixin';
import CardMixin from './CardMixin';
import StacLink from './StacLink.vue';
import GlossaryTooltip from './GlossaryTooltip.vue';
import { STAC } from 'stac-js';
import { formatTemporalExtent } from '@radiantearth/stac-fields/formatters';
import { BCard, BCardBody, BCardFooter, BCardImg, BCardText, BCardTitle } from 'bootstrap-vue-next';

export default {
  name: 'Catalog',
  components: {
    BCard,
    BCardBody,
    BCardFooter,
    BCardImg,
    BCardText,
    BCardTitle,
    StacLink,
    GlossaryTooltip,
    Keywords: defineAsyncComponent(() => import('./Keywords.vue')),
    AddToCollection: defineAsyncComponent(() => import('./AddToCollection.vue'))
  },
  mixins: [
    FileFormatsMixin,
    CardMixin,
    StacFieldsMixin({ formatTemporalExtent })
  ],
  props: {
    catalog: {
      type: Object,
      required: true
    }
  },
  computed: {
    ...mapState(['showKeywordsInCatalogCards']),
    ...mapGetters(['getStac']),
    classes() {
      let classes = ['catalog-card'];
      if (!this.data) {
        classes.push('queued');
      }
      if (this.data && this.data.deprecated) {
        classes.push('deprecated');
      }
      if (this.hasImage) {
        classes.push('has-thumbnail');
      }
      return classes;
    },
    data() {
      return this.getStac(this.catalog);
    },
    temporalExtent() {
      if (this.data?.isCollection() && this.data.extent?.temporal?.interval.length > 0) {
        let extent = this.data.extent.temporal.interval[0];
        if (Array.isArray(extent) && (typeof extent[0] === 'string' || typeof extent[1] === 'string')) {
          return this.formatTemporalExtent(this.data.extent.temporal.interval[0], true);
        }
      }
      return null;
    },
    // Extract model components from collection metadata.
    // Option A layout: collapsed collection has a "components" list field
    // (e.g. ["echam","fesom","jsbach","oasis3mct"]).
    // Legacy layout: single "model" string field per per-component collection.
    modelComponents() {
      if (!this.data?.isCollection()) {
        return [];
      }
      // Option A: "components" list (preferred)
      const components = this.data.components;
      if (Array.isArray(components) && components.length > 0) {
        return components;
      }
      // Legacy: single "model" string
      const model = this.data.model || this.data.properties?.model;
      if (model) {
        return Array.isArray(model) ? model : [model];
      }
      // Fallback: parse known component names from the collection ID
      const id = this.data.id || '';
      const knownComponents = ['echam', 'fesom', 'jsbach', 'hdmodel', 'oasis', 'recom', 'pism'];
      const found = knownComponents.filter(comp =>
        id.toLowerCase().includes(comp) ||
        (this.data.title || '').toLowerCase().includes(comp)
      );
      return found.map(c => c.toUpperCase());
    },
    // CO2 concentration from namelist parameters, displayed in ppm
    co2Display() {
      if (!this.data?.isCollection()) {
        return null;
      }
      // Look for CO2 VMR in namelist properties (nml:radctl:co2vmr)
      const props = this.data.properties || this.data;
      for (const key of Object.keys(props)) {
        if (key.toLowerCase().includes('co2vmr') || key.toLowerCase().includes('co2_vmr')) {
          const val = props[key];
          if (typeof val === 'number' && val > 0) {
            // Convert from decimal (volume mixing ratio) to ppm
            const ppm = val < 0.01 ? val * 1e6 : val;
            return `${Math.round(ppm)} ppm`;
          }
        }
      }
      return null;
    },
    // Calculate run length from temporal extent
    runLength() {
      if (!this.data?.isCollection() || !this.data.extent?.temporal?.interval?.length) {
        return null;
      }
      const interval = this.data.extent.temporal.interval[0];
      if (!interval || !interval[0] || !interval[1]) {
        return null;
      }
      try {
        const start = new Date(interval[0]);
        const end = new Date(interval[1]);
        const years = Math.round((end - start) / (365.25 * 24 * 60 * 60 * 1000));
        if (years > 0) {
          return `${years} year${years !== 1 ? 's' : ''}`;
        }
      } catch {
        // Invalid dates
      }
      return null;
    },
    // Resolution information from metadata
    resolution() {
      if (!this.data?.isCollection()) {
        return null;
      }
      const props = this.data.properties || this.data;
      // Look for resolution fields
      const atmosRes = props['resolution:atmosphere'] || props['atmos_resolution'];
      const oceanRes = props['resolution:ocean'] || props['ocean_resolution'] || props['fesom:mesh_path'];
      if (atmosRes && oceanRes) {
        return `${atmosRes}/${oceanRes}`;
      }
      return atmosRes || oceanRes || null;
    },
    // Paleo time display (if applicable)
    paleoDisplay() {
      if (!this.data?.isCollection()) {
        return null;
      }
      const props = this.data.properties || this.data;
      // Check for paleo:display field or similar
      const paleoProp = props['paleo:display'] || props['paleo_time'] || props['paleodatetime'];
      if (paleoProp) {
        return paleoProp;
      }
      // Check if temporal extent is in deep time (before 1 CE)
      const interval = this.data.extent?.temporal?.interval?.[0];
      if (interval && interval[0]) {
        try {
          const startYear = new Date(interval[0]).getFullYear();
          if (startYear < 0) {
            // Display as BCE
            return `${Math.abs(startYear)} BCE`;
          }
        } catch {
          // Not a valid date
        }
      }
      return null;
    },
    // Check if we have any quick facts to display
    hasQuickFacts() {
      return this.co2Display || this.runLength || this.resolution || this.paleoDisplay || this.dataVolume;
    },
    // Data volume display (total size of collection)
    dataVolume() {
      if (!this.data?.isCollection()) {
        return null;
      }
      const props = this.data.properties || this.data;
      // Look for file size properties
      const totalBytes = props['catalog:total_bytes'] || props['file:size'] || props['total_size'];
      if (!totalBytes || totalBytes <= 0) {
        return null;
      }
      // Format as human-readable size
      const gb = totalBytes / (1024 ** 3);
      if (gb >= 1000) {
        return `${(gb / 1024).toFixed(1)} TB`;
      }
      if (gb >= 1) {
        return `${gb.toFixed(1)} GB`;
      }
      const mb = totalBytes / (1024 ** 2);
      return `${mb.toFixed(0)} MB`;
    },
    // DOI from scientific citation extension
    doi() {
      if (!this.data?.isCollection()) {
        return null;
      }
      const props = this.data.properties || this.data;
      return props['sci:doi'] || props['doi'] || null;
    },
    // DOI URL for linking
    doiUrl() {
      if (!this.doi) return null;
      // Handle both bare DOI and full URL
      if (this.doi.startsWith('http')) {
        return this.doi;
      }
      return `https://doi.org/${this.doi}`;
    },
    // Generate citation text
    citationText() {
      if (!this.data?.isCollection()) {
        return '';
      }
      const title = this.data.title || this.data.id;
      const year = this.extractYear();
      const doi = this.doi ? ` DOI: ${this.doi}` : '';
      return `${title} (${year}).${doi}`;
    },
    // Browser path for Add to Collection (e.g. /experiments/basic-001)
    collectionId() {
      return this.data?.getBrowserPath?.() || null;
    },
    // STAC ID used for comparison (plain ID like "basic-002", not a browser path)
    stacId() {
      return this.data?.isCollection() ? (this.data.id || null) : null;
    },
    // Can this collection be compared?
    canCompare() {
      return !!this.stacId;
    },
    // Is this collection selected for comparison?
    isSelectedForComparison() {
      return this.$store.getters['comparison/isSelected'](this.stacId);
    }
  },
  methods: {
    load(visible) {
      if (this.catalog instanceof STAC) {
        return;
      }
      this.$store.commit(visible ? 'queue' : 'unqueue', this.catalog.getAbsoluteUrl());
    },
    // Return Bootstrap variant for component badge color coding
    componentVariant(component) {
      const comp = component.toLowerCase();
      // Color coding: blue=ocean, warning=atmosphere, success=land, secondary=other
      if (['fesom', 'fesom2', 'mpiom', 'nemo'].includes(comp)) {
        return 'primary'; // Blue for ocean
      }
      if (['echam', 'echam6', 'icon-a', 'ifs'].includes(comp)) {
        return 'warning'; // Orange/yellow for atmosphere
      }
      if (['jsbach', 'clm', 'lpjguess'].includes(comp)) {
        return 'success'; // Green for land/vegetation
      }
      if (['hdmodel', 'hd'].includes(comp)) {
        return 'info'; // Cyan for hydrology
      }
      if (['oasis', 'oasis3mct'].includes(comp)) {
        return 'dark'; // Dark for coupler
      }
      if (['recom', 'hamocc', 'pisces'].includes(comp)) {
        return 'danger'; // Red for biogeochemistry
      }
      return 'secondary'; // Default gray
    },
    // Extract year from temporal extent for citation
    extractYear() {
      if (!this.data?.extent?.temporal?.interval?.length) {
        return 'n.d.';
      }
      const interval = this.data.extent.temporal.interval[0];
      if (interval && interval[0]) {
        try {
          return new Date(interval[0]).getFullYear();
        } catch {
          return 'n.d.';
        }
      }
      return 'n.d.';
    },
    // Copy citation to clipboard
    async copyCitation() {
      try {
        await navigator.clipboard.writeText(this.citationText);
        // Could add toast notification here
      } catch (err) {
        console.warn('Failed to copy citation:', err);
      }
    },
    // Toggle comparison selection
    toggleComparison() {
      if (this.stacId) {
        this.$store.dispatch('comparison/toggleCollection', this.stacId);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.quick-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;

  span {
    white-space: nowrap;
  }
}

// Ensure the stretched-link doesn't interfere with the right-side actions
.catalog-card .card-title {
  position: relative;

  .stretched-link {
    flex-grow: 1;
  }
}

// DOI citation section
.doi-citation {
  z-index: 1;
  position: relative;

  .doi-link {
    text-decoration: none;
  }

  .cite-btn {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
  }
}

// Component badges row below the card title
.model-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

// Right-side header actions: Compare badge + star
.card-header-actions {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.25rem;
  z-index: 1;
  position: relative;
}

// Compare styled as a badge-like toggle button
.compare-badge {
  font-size: 0.75em;
  padding: 0.25em 0.5em;
  line-height: 1;
  border-radius: 0.375rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
