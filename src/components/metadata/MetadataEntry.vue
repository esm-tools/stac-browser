<template>
  <b-row>
    <b-col :md="showTable || showTree ? 12 : 3" class="label" :title="field">
      <span v-html="highlightedLabel" />
    </b-col>
    <b-col v-if="showTree" md="12" class="value mt-2">
      <NamelistTree :parameters="value" :highlight="highlight" />
    </b-col>
    <b-col v-else-if="showTable" md="12" class="value mt-2">
      <MetadataTable v-bind="$props" />
    </b-col>
    <b-col v-else-if="isCodeSnippet" md="12" class="value mt-2">
      <CodeSnippet :code="value" :label="label" :language="codeLanguage" />
    </b-col>
    <b-col v-else md="9" class="value">
      <div v-html="highlightedFormatted" />
    </b-col>
  </b-row>
</template>

<script>
import EntryMixin from './EntryMixin';
import { size } from 'stac-js/src/utils.js';
import { defineAsyncComponent } from 'vue';

const FORCE_TABLE = [
  'languages',
  'eo:bands',
  'raster:bands',
  'bands'
];

const CODE_SNIPPET_FIELDS = [
  'xarray_snippet'
];

const TREE_VIEW_FIELDS = [
  'nml:parameters'
];

export default {
  name: "MetadataEntry",
  components: {
    MetadataTable: defineAsyncComponent(() => import('./MetadataTable.vue')),
    CodeSnippet: defineAsyncComponent(() => import('./CodeSnippet.vue')),
    NamelistTree: defineAsyncComponent(() => import('./NamelistTree.vue'))
  },
  mixins: [
    EntryMixin
  ],
  props: {
    highlight: {
      type: String,
      default: ''
    }
  },
  computed: {
    showTable() {
      return FORCE_TABLE.includes(this.field) || this.itemOrder.length > 0 && size(this.value) >= 3;
    },
    showTree() {
      return TREE_VIEW_FIELDS.includes(this.field) && typeof this.value === 'object' && this.value !== null;
    },
    isCodeSnippet() {
      return CODE_SNIPPET_FIELDS.includes(this.field) && typeof this.value === 'string';
    },
    codeLanguage() {
      if (this.field.includes('xarray') || this.field.includes('python')) {
        return 'python';
      }
      return 'text';
    },
    highlightedLabel() {
      return this.applyHighlight(this.label);
    },
    highlightedFormatted() {
      return this.applyHighlight(this.formatted);
    }
  },
  methods: {
    applyHighlight(text) {
      if (!this.highlight || !text) {
        return text;
      }

      const query = this.highlight.toLowerCase();
      const lowerText = text.toLowerCase();

      // Find all occurrences and highlight them
      let result = '';
      let lastIndex = 0;
      let searchIndex = 0;

      while ((searchIndex = lowerText.indexOf(query, lastIndex)) !== -1) {
        // Add text before the match
        result += text.substring(lastIndex, searchIndex);
        // Add the highlighted match (preserving original case)
        result += '<mark>' + text.substring(searchIndex, searchIndex + this.highlight.length) + '</mark>';
        lastIndex = searchIndex + this.highlight.length;
      }

      // Add remaining text
      result += text.substring(lastIndex);

      return result;
    }
  }
};
</script>

<style scoped>
:deep(mark) {
  background-color: #fff3cd;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
