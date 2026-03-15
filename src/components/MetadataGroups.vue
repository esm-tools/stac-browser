<template>
  <section v-if="formattedData.length > 0" class="metadata">
    <component :is="headerTag" v-if="title" class="metadata-header">
      {{ titleText }}
      <span class="field-count">({{ totalFieldCount }} fields)</span>
    </component>

    <div class="metadata-controls mb-3">
      <div class="search-container">
        <b-form-input
          v-model="searchInput"
          type="search"
          :placeholder="$t('metadata.search') || 'Search metadata...'"
          class="metadata-search"
          @input="onSearchInput"
        />
      </div>
      <div class="collapse-controls">
        <b-button size="sm" variant="outline-secondary" @click="expandAll">
          {{ $t('metadata.expandAll') || 'Expand All' }}
        </b-button>
        <b-button size="sm" variant="outline-secondary" @click="collapseAll">
          {{ $t('metadata.collapseAll') || 'Collapse All' }}
        </b-button>
      </div>
    </div>

    <b-card-group columns :class="`count-${filteredData.length}`">
      <MetadataGroup
        v-for="group in filteredData"
        :key="group.extension"
        v-bind="group"
        :collapsed="collapsedGroups[group.extension]"
        :highlight="searchQuery"
        @toggle="toggleGroup(group.extension)"
      />
    </b-card-group>
  </section>
</template>

<script>
import { BCardGroup, BFormInput, BButton } from 'bootstrap-vue-next';
import {
  formatAsset,
  formatCatalog,
  formatCollection,
  formatGrouped,
  formatItemProperties,
  formatLink,
  formatProvider,
  formatSummaries,
} from "@radiantearth/stac-fields";
import StacFieldsMixin from './StacFieldsMixin';
import MetadataGroup from "./metadata/MetadataGroup.vue";
import { isoDuration } from "@musement/iso-duration";
import { mapState } from "vuex";
// Register custom fields for the metadata rendering

import "../../fields.config";

export default {
  name: "MetadataGroups",
  components: {
    BCardGroup,
    BFormInput,
    BButton,
    MetadataGroup,
  },
  mixins: [
    StacFieldsMixin({}),
  ],
  props: {
    data: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    context: {
      type: Object,
      default: null,
    },
    ignoreFields: {
      type: Array,
      default: () => [],
    },
    title: {
      type: [Boolean, String],
      default: true,
    },
    headerTag: {
      type: String,
      default: "h2",
    },
  },
  data() {
    return {
      formattedData: [],
      searchInput: '',
      searchQuery: '',
      searchTimeout: null,
      collapsedGroups: {},
    };
  },
  computed: {
    ...mapState(["uiLanguage"]),
    titleText() {
      if (typeof this.title === "string") {
        return this.title;
      }
      return this.$t("metadata.title");
    },
    totalFieldCount() {
      return this.formattedData.reduce((count, group) => {
        return count + Object.keys(group.properties || {}).length;
      }, 0);
    },
    filteredData() {
      if (!this.searchQuery) {
        return this.formattedData;
      }

      const query = this.searchQuery.toLowerCase();

      return this.formattedData
        .map(group => {
          const filteredProperties = {};

          for (const [key, entry] of Object.entries(group.properties || {})) {
            const keyMatch = key.toLowerCase().includes(query);
            const labelMatch = entry.label && entry.label.toLowerCase().includes(query);
            const valueMatch = this.valueMatchesQuery(entry.value, query) ||
                              (entry.formatted && entry.formatted.toLowerCase().includes(query));

            if (keyMatch || labelMatch || valueMatch) {
              filteredProperties[key] = entry;
            }
          }

          if (Object.keys(filteredProperties).length > 0) {
            return {
              ...group,
              properties: filteredProperties
            };
          }
          return null;
        })
        .filter(group => group !== null);
    },
  },
  watch: {
    uiLanguage: {
      immediate: true,
      async handler(locale) {
        if (!locale) {
          return;
        }

        // Update durations (for stac-fields)
        const en = (await import(`../locales/${locale}/duration.js`)).default;
        isoDuration.setLocales({ en });

        // Format the data again to update translations
        this.formattedData = this.formatData();
        this.initCollapsedState();
      },
    },
  },
  methods: {
    formatData() {
      // Filter all fields as given in ignoreFields and also
      // ignore fields starting with an underscore which is likely originating from the STAC class
      let filter = (key) =>
        !key.startsWith("_") && !this.ignoreFields.includes(key);
      switch (this.type) {
        case "Asset":
          return formatAsset(this.data.toJSON(), this.context, filter);
        case "Link":
          return formatLink(this.data, this.context, filter);
        case "Provider":
          return formatProvider(this.data, this.context, filter);
        case "Item":
          return formatItemProperties(this.data, filter);
        case "Catalog":
          return formatCatalog(this.data, filter);
        case "Collection": {
          let core = formatCollection(this.data, filter);
          let summaries = formatSummaries(this.data, filter);
          // Merge summaries into collection metadata
          summaries.forEach((summaryGroup) => {
            let index = core.findIndex(
              (coreGroup) => summaryGroup.extension === coreGroup.extension
            );
            if (index !== -1) {
              Object.assign(core[index].properties, summaryGroup.properties);
            } else {
              core.push(summaryGroup);
            }
          });
          const collator = new Intl.Collator(this.uiLanguage);
          return core.sort((a, b) => collator.compare(a.label, b.label));
        }
        case "FeatureCollection":
          return {};
        default:
          return formatGrouped(this.context, this.data, this.type, filter);
      }
    },
    initCollapsedState() {
      // Default: all groups collapsed
      const collapsed = {};
      this.formattedData.forEach(group => {
        collapsed[group.extension] = true;
      });
      this.collapsedGroups = collapsed;
    },
    onSearchInput() {
      // Debounce search input (200ms)
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.searchQuery = this.searchInput;
        // Auto-expand groups when searching
        if (this.searchQuery) {
          this.expandAll();
        }
      }, 200);
    },
    valueMatchesQuery(value, query) {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === 'string') {
        return value.toLowerCase().includes(query);
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).toLowerCase().includes(query);
      }
      if (Array.isArray(value)) {
        return value.some(item => this.valueMatchesQuery(item, query));
      }
      if (typeof value === 'object') {
        return Object.entries(value).some(([k, v]) =>
          k.toLowerCase().includes(query) || this.valueMatchesQuery(v, query)
        );
      }
      return false;
    },
    toggleGroup(extension) {
      this.collapsedGroups[extension] = !this.collapsedGroups[extension];
    },
    expandAll() {
      const collapsed = {};
      this.formattedData.forEach(group => {
        collapsed[group.extension] = false;
      });
      this.collapsedGroups = collapsed;
    },
    collapseAll() {
      const collapsed = {};
      this.formattedData.forEach(group => {
        collapsed[group.extension] = true;
      });
      this.collapsedGroups = collapsed;
    },
  },
};
</script>

<style lang="scss">
@import "../theme/variables.scss";

#stac-browser {
  .metadata {
    .metadata-header {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;

      .field-count {
        font-size: 0.7em;
        font-weight: normal;
        color: #6c757d;
      }
    }

    .metadata-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;

      .search-container {
        flex: 1;
        min-width: 200px;
        max-width: 400px;

        .metadata-search {
          width: 100%;
        }
      }

      .collapse-controls {
        display: flex;
        gap: 0.5rem;
      }
    }

    .card {
      border: 0;
      margin-top: $block-margin;
      margin-bottom: $block-margin;
      text-align: left;

      .metadata-rows {
        border-radius: $border-radius;
      }

      .row {
        padding: 0.4rem;
        border-top: 1px solid rgba(0, 0, 0, 0.125);

        &:first-child {
          border-top: 0;
        }
        &:nth-child(odd) {
          background: rgba(0, 0, 0, 0.03);
        }
      }
    }
    .row {
      margin: 0;
      padding: 0;
    }
    .label {
      margin: 0;
      padding-left: 0;
      font-weight: 600;
      vertical-align: top;
    }
    .value {
      margin: 0;
      padding-right: 0;

      > ul,
      > ol,
      > pre,
      > dl,
      > .description {
        max-height: 15em;
        overflow: auto;
      }

      .styled-description {
        h1 {
          font-size: 1.5em;
        }
        h2 {
          font-size: 1.4em;
        }
        h3 {
          font-size: 1.3em;
        }
        h4 {
          font-size: 1.2em;
        }
        h5 {
          font-size: 1.1em;
        }
        h6 {
          font-size: 1em;
        }
      }
    }
    ul {
      padding-left: 1.4em;
      margin-bottom: 0;
    }
    ol {
      padding-left: 2em;
      margin-bottom: 0;
    }
    ul li {
      list-style-type: "• ";
    }
    dl {
      margin: 0;
      margin-left: 1em;
      margin-bottom: 0.5em;

      &:only-child {
        margin-left: 0;
        margin-bottom: 0;
      }
      dl:only-child {
        margin-left: 1em;
      }
    }
    ul > li > dl,
    ol > li > dl {
      margin-left: 0;
    }
    dt {
      display: inline;
    }
    dt:after {
      content: ": ";
    }
    dd {
      display: inline;

      &:not(:last-of-type) > dl:only-child {
        margin-bottom: -1em;
      }
      &:after {
        content: "\A";
        white-space: pre;
        line-height: 1px;
      }
      &:last-of-type:after {
        content: "";
        white-space: normal;
      }
      .description {
        display: inline-block;

        > p:only-child {
          display: inline;
        }
      }
      > ul,
      > ol {
        max-height: 15em;
        overflow: auto;
      }
    }
    .provider .description {
      font-size: 0.9em;
      line-height: 1.5em;
      margin-bottom: 0.5em;
    }
    .checksum-input {
      width: 100%;
    }

    .color {
      text-align: center;

      .color-code {
        color: white;
        text-shadow: 1px 1px 1px #000;
        text-align: center;
      }
    }
  }
}
</style>
