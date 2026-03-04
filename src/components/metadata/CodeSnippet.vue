<template>
  <div class="code-snippet">
    <div class="code-snippet-header">
      <span class="code-snippet-label">{{ label }}</span>
      <CopyButton
        :copyText="code"
        variant="outline-secondary"
        :buttonProps="{ size: 'sm' }"
      />
    </div>
    <pre class="code-snippet-content"><code ref="codeBlock" :class="languageClass">{{ code }}</code></pre>
  </div>
</template>

<script>
import CopyButton from '../CopyButton.vue';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import 'highlight.js/styles/vs2015.css';

hljs.registerLanguage('python', python);

export default {
  name: 'CodeSnippet',
  components: {
    CopyButton
  },
  props: {
    code: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: 'Code'
    },
    language: {
      type: String,
      default: 'python'
    }
  },
  computed: {
    languageClass() {
      return `language-${this.language}`;
    }
  },
  mounted() {
    this.highlightCode();
  },
  updated() {
    this.highlightCode();
  },
  methods: {
    highlightCode() {
      if (this.$refs.codeBlock) {
        hljs.highlightElement(this.$refs.codeBlock);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import '../../theme/variables.scss';

.code-snippet {
  border: 1px solid #ddd;
  border-radius: $border-radius;
  overflow: hidden;
  background-color: #f8f9fa;

  .code-snippet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background-color: #e9ecef;
    border-bottom: 1px solid #ddd;

    .code-snippet-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: $secondary;
    }
  }

  .code-snippet-content {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background-color: #1e1e1e;
    font-family: $font-family-monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    max-height: none;

    :deep(code) {
      background: transparent;
      padding: 0;
      font-size: inherit;
      font-family: inherit;
    }
  }
}
</style>
