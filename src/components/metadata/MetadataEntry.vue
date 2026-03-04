<template>
  <b-row>
    <b-col :md="showTable ? 12 : 3" class="label" :title="field">
      <span v-html="label" />
    </b-col>
    <b-col v-if="showTable" md="12" class="value mt-2">
      <MetadataTable v-bind="$props" />
    </b-col>
    <b-col v-else-if="isCodeSnippet" md="12" class="value mt-2">
      <CodeSnippet :code="value" :label="label" :language="codeLanguage" />
    </b-col>
    <b-col v-else md="9" class="value">
      <div v-html="formatted" />
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

export default {
  name: "MetadataEntry",
  components: {
    MetadataTable: defineAsyncComponent(() => import('./MetadataTable.vue')),
    CodeSnippet: defineAsyncComponent(() => import('./CodeSnippet.vue'))
  },
  mixins: [
    EntryMixin
  ],
  computed: {
    showTable() {
      return FORCE_TABLE.includes(this.field) || this.itemOrder.length > 0 && size(this.value) >= 3;
    },
    isCodeSnippet() {
      return CODE_SNIPPET_FIELDS.includes(this.field) && typeof this.value === 'string';
    },
    codeLanguage() {
      if (this.field.includes('xarray') || this.field.includes('python')) {
        return 'python';
      }
      return 'text';
    }
  }
};
</script>
