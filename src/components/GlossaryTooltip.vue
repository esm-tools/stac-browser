<template>
  <span
    v-if="hasDefinition"
    class="glossary-term"
    :title="tooltip"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <slot>{{ term }}</slot>
    <sup v-if="showIcon" class="glossary-icon">?</sup>
  </span>
  <span v-else>
    <slot>{{ term }}</slot>
  </span>
</template>

<script>
import glossary from '../data/glossary.json';

export default {
  name: 'GlossaryTooltip',
  props: {
    term: {
      type: String,
      required: true
    },
    showIcon: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showTooltip: false
    };
  },
  computed: {
    definition() {
      // Look up term in glossary (case-insensitive)
      const key = Object.keys(glossary).find(
        k => k.toLowerCase() === this.term.toLowerCase()
      );
      return key ? glossary[key] : null;
    },
    hasDefinition() {
      return this.definition !== null;
    },
    tooltip() {
      if (!this.definition) return '';
      return `${this.definition.term}: ${this.definition.description}`;
    }
  }
};
</script>

<style lang="scss" scoped>
.glossary-term {
  cursor: help;
  border-bottom: 1px dotted #6c757d;

  &:hover {
    border-bottom-color: #0d6efd;
  }
}

.glossary-icon {
  font-size: 0.65em;
  color: #6c757d;
  margin-left: 1px;
}
</style>
