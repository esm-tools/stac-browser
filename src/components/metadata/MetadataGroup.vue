<template>
  <b-card no-body :key="extension" :class="['metadata-card', `ext-${extension}`]">
    <b-card-title class="group-title" @click="$emit('toggle')">
      <span class="toggle-icon">{{ collapsed ? '+' : '-' }}</span>
      <span v-if="label" v-html="label" />
      <template v-else>{{ $t('metadata.general') }}</template>
      <span class="property-count">({{ propertyCount }})</span>
    </b-card-title>
    <b-collapse :visible="!collapsed">
      <section class="border metadata-rows">
        <MetadataEntry
          v-for="(entry, key) in properties"
          :field="key"
          :key="key"
          v-bind="entry"
          :highlight="highlight"
        />
      </section>
    </b-collapse>
  </b-card>
</template>

<script>
import MetadataEntry from './MetadataEntry.vue';
import { BCard, BCardTitle, BCollapse } from 'bootstrap-vue-next';

export default {
  name: "MetadataGroup",
  components: {
    MetadataEntry,
    BCard,
    BCardTitle,
    BCollapse
  },
  props: {
    label: {
      type: String,
      default: ''
    },
    extension: {
      type: String,
      default: ''
    },
    properties: {
      type: Object,
      required: true
    },
    collapsed: {
      type: Boolean,
      default: false
    },
    highlight: {
      type: String,
      default: ''
    }
  },
  emits: ['toggle'],
  computed: {
    propertyCount() {
      return Object.keys(this.properties || {}).length;
    }
  }
};
</script>

<style lang="scss" scoped>
.group-title {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    opacity: 0.8;
  }

  .toggle-icon {
    font-family: monospace;
    font-weight: bold;
    width: 1em;
    text-align: center;
  }

  .property-count {
    font-size: 0.8em;
    font-weight: normal;
    color: #6c757d;
    margin-left: auto;
  }
}
</style>
