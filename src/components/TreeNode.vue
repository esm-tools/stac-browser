<template>
  <div
    class="tree-node"
    :class="{
      'tree-node--folder': isFolder,
      'tree-node--collection': !isFolder,
      'tree-node--drag-over': isDragOver
    }"
    :draggable="true"
    @dragstart.stop="onDragStart"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent.stop="onDrop"
  >
    <div class="tree-node__row d-flex align-items-center py-1 px-2" @click="toggle">
      <span v-if="isFolder" class="tree-node__toggle me-1">
        <span v-if="expanded">&#9660;</span>
        <span v-else>&#9654;</span>
      </span>
      <span class="tree-node__icon me-1">
        <span v-if="isFolder">&#128193;</span>
        <span v-else>&#128230;</span>
      </span>
      <span class="tree-node__name flex-grow-1">{{ node.name }}</span>

      <span v-if="!isFolder && typeof node.item_count === 'number'" class="tree-node__count text-muted small me-2">
        ({{ node.item_count }} item{{ node.item_count !== 1 ? 's' : '' }})
      </span>

      <BBadge
        v-for="label in nodeLabels"
        :key="label.id"
        class="me-1"
        :style="{ backgroundColor: label.color, color: contrastColor(label.color) }"
      >{{ label.name }}</BBadge>

      <BBadge
        v-for="share in (node.shares || [])"
        :key="share.username"
        variant="outline-info"
        class="me-1"
      >{{ share.username }}</BBadge>

      <div class="tree-node__actions" @click.stop>
        <BButton size="sm" variant="link" class="p-0 me-1" title="Edit" @click="$emit('edit-node', node)">
          &#9998;
        </BButton>
        <BButton size="sm" variant="link" class="p-0 me-1 text-danger" title="Delete" @click="$emit('delete-node', node)">
          &#10005;
        </BButton>
        <BButton
          v-if="!isFolder"
          size="sm"
          variant="link"
          class="p-0 me-1"
          title="Share"
          @click="$emit('share-node', node)"
        >
          &#128279;
        </BButton>
        <BButton
          v-if="!isFolder"
          size="sm"
          variant="link"
          class="p-0"
          title="Add items"
          @click="$emit('add-items', node)"
        >
          +
        </BButton>
      </div>
    </div>

    <div v-if="isFolder && expanded && node.children && node.children.length > 0" class="tree-node__children ms-3">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :labels="labels"
        @edit-node="$emit('edit-node', $event)"
        @delete-node="$emit('delete-node', $event)"
        @share-node="$emit('share-node', $event)"
        @add-items="$emit('add-items', $event)"
        @move-node="$emit('move-node', $event)"
      />
    </div>
  </div>
</template>

<script>
import { BBadge, BButton } from 'bootstrap-vue-next';

export default {
  name: 'TreeNode',
  components: {
    BBadge,
    BButton
  },
  props: {
    node: {
      type: Object,
      required: true
    },
    labels: {
      type: Array,
      default: () => []
    }
  },
  emits: ['edit-node', 'delete-node', 'share-node', 'add-items', 'move-node'],
  data() {
    return {
      expanded: false,
      isDragOver: false
    };
  },
  computed: {
    isFolder() {
      return this.node.type === 'folder';
    },
    nodeLabels() {
      if (!Array.isArray(this.node.label_ids) || this.node.label_ids.length === 0) {
        return [];
      }
      return this.labels.filter(l => this.node.label_ids.includes(l.id));
    }
  },
  methods: {
    toggle() {
      if (this.isFolder) {
        this.expanded = !this.expanded;
      }
    },
    onDragStart(event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify({
        id: this.node.id,
        type: this.node.type
      }));
    },
    onDragOver(event) {
      if (this.isFolder) {
        event.dataTransfer.dropEffect = 'move';
        this.isDragOver = true;
      }
    },
    onDragLeave() {
      this.isDragOver = false;
    },
    onDrop(event) {
      this.isDragOver = false;
      if (!this.isFolder) {
        return;
      }
      try {
        const raw = event.dataTransfer.getData('application/json');
        if (!raw) {
          return;
        }
        const source = JSON.parse(raw);
        if (source.id === this.node.id) {
          return;
        }
        this.$emit('move-node', {
          sourceId: source.id,
          targetFolderId: this.node.id
        });
      } catch (err) {
        console.error('TreeNode drop error:', err);
      }
    },
    contrastColor(hex) {
      if (!hex || hex.length < 7) {
        return '#000';
      }
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000' : '#fff';
    }
  }
};
</script>

<style lang="scss" scoped>
.tree-node {
  user-select: none;

  &--drag-over > .tree-node__row {
    background-color: rgba(var(--bs-primary-rgb, 13, 110, 253), 0.15);
    border-radius: 0.25rem;
  }

  .tree-node__row {
    cursor: pointer;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
  }

  .tree-node__toggle {
    font-size: 0.65rem;
    width: 1rem;
    text-align: center;
  }

  .tree-node__icon {
    font-size: 1rem;
  }

  .tree-node__name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tree-node__actions {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .tree-node__row:hover .tree-node__actions {
    opacity: 1;
  }

  .tree-node__children {
    border-left: 1px solid rgba(0, 0, 0, 0.1);
  }
}
</style>
