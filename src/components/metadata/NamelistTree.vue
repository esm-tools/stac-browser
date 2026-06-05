<template>
  <div class="namelist-tree">
    <div
      v-for="(groupData, groupName) in treeData"
      :key="groupName"
      class="namelist-group"
    >
      <div
        class="namelist-group-header"
        @click="toggleGroup(groupName)"
      >
        <span class="toggle-icon">{{ collapsedGroups[groupName] ? '+' : '-' }}</span>
        <span class="group-name">{{ groupName }}</span>
        <span class="param-count">({{ Object.keys(groupData).length }})</span>
      </div>
      <b-collapse :visible="!collapsedGroups[groupName]">
        <div class="namelist-params">
          <div
            v-for="(value, key) in groupData"
            :key="key"
            class="namelist-param"
          >
            <span class="param-key" v-html="highlightText(key)" />
            <span class="param-separator">:</span>
            <span class="param-value" v-html="highlightText(formatValue(value))" />
          </div>
        </div>
      </b-collapse>
    </div>
  </div>
</template>

<script>
import { BCollapse } from 'bootstrap-vue-next';

export default {
  name: "NamelistTree",
  components: {
    BCollapse
  },
  props: {
    parameters: {
      type: Object,
      required: true
    },
    highlight: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      collapsedGroups: {}
    };
  },
  computed: {
    treeData() {
      const tree = {};

      for (const [key, value] of Object.entries(this.parameters || {})) {
        // Split on colon to get group and param name
        // e.g., "radctl:co2vmr" -> group="radctl", param="co2vmr"
        const colonIndex = key.indexOf(':');

        if (colonIndex > 0) {
          const groupName = key.substring(0, colonIndex);
          const paramName = key.substring(colonIndex + 1);

          if (!tree[groupName]) {
            tree[groupName] = {};
          }
          tree[groupName][paramName] = value;
        } else {
          // No group prefix, put in "other" group
          if (!tree['other']) {
            tree['other'] = {};
          }
          tree['other'][key] = value;
        }
      }

      return tree;
    }
  },
  watch: {
    treeData: {
      immediate: true,
      handler(newTreeData) {
        // Initialize collapsed state for all groups (collapsed by default)
        const collapsed = {};
        for (const groupName of Object.keys(newTreeData)) {
          collapsed[groupName] = true;
        }
        this.collapsedGroups = collapsed;
      }
    }
  },
  methods: {
    toggleGroup(groupName) {
      this.collapsedGroups[groupName] = !this.collapsedGroups[groupName];
    },
    formatValue(value) {
      if (value === null || value === undefined) {
        return 'null';
      }
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      if (typeof value === 'number') {
        return String(value);
      }
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return '[' + value.map(v => this.formatValue(v)).join(', ') + ']';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    },
    highlightText(text) {
      if (!this.highlight || !text) {
        return text;
      }

      const textStr = String(text);
      const query = this.highlight.toLowerCase();
      const lowerText = textStr.toLowerCase();
      const index = lowerText.indexOf(query);

      if (index === -1) {
        return textStr;
      }

      const before = textStr.substring(0, index);
      const match = textStr.substring(index, index + this.highlight.length);
      const after = textStr.substring(index + this.highlight.length);

      return `${before}<mark>${match}</mark>${after}`;
    }
  }
};
</script>

<style lang="scss" scoped>
.namelist-tree {
  width: 100%;

  .namelist-group {
    margin-bottom: 0.5rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .namelist-group-header {
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }

    .toggle-icon {
      font-family: monospace;
      font-weight: bold;
      width: 1em;
      text-align: center;
    }

    .group-name {
      font-weight: 600;
      font-family: monospace;
    }

    .param-count {
      font-size: 0.85em;
      color: #6c757d;
      margin-left: auto;
    }
  }

  .namelist-params {
    padding-left: 1.5rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }

  .namelist-param {
    display: flex;
    gap: 0.25rem;
    padding: 0.15rem 0;
    font-family: monospace;
    font-size: 0.9em;

    .param-key {
      color: #0066cc;
    }

    .param-separator {
      color: #666;
    }

    .param-value {
      color: #333;
    }
  }
}

:deep(mark) {
  background-color: #fff3cd;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
