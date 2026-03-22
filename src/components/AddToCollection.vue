<template>
  <div class="add-to-collection">
    <BButton
      size="sm"
      variant="outline-primary"
      @click="showModal = true"
      title="Add to personal collection"
    >
      <span class="me-1">&#9733;</span>
      <span class="button-label">Add to Collection</span>
    </BButton>

    <BModal
      v-model="showModal"
      title="Add to Personal Collection"
      @ok="addToCollection"
      @hidden="resetForm"
      ok-title="Add"
      :ok-disabled="!selectedCollection"
    >
      <div v-if="loadingCollections" class="text-center py-3">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span class="ms-2 text-muted">Loading collections...</span>
      </div>

      <div v-else-if="collectionsError" class="text-danger small">
        Failed to load collections: {{ collectionsError }}
      </div>

      <div v-else-if="flatCollections.length === 0" class="text-muted small py-3 text-center">
        No personal collections found. <router-link to="/collections/personal">Create one first.</router-link>
      </div>

      <template v-else>
        <BFormGroup label="Select collection" label-for="select-collection">
          <BFormSelect
            id="select-collection"
            v-model="selectedCollection"
            :options="collectionOptions"
          />
        </BFormGroup>
        <div class="mt-3 small text-muted">
          Adding item: <strong>{{ itemId }}</strong>
        </div>
      </template>
    </BModal>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import {
  BButton,
  BFormGroup,
  BFormSelect,
  BModal
} from 'bootstrap-vue-next';

export default {
  name: 'AddToCollection',
  components: {
    BButton,
    BFormGroup,
    BFormSelect,
    BModal
  },
  props: {
    itemId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      showModal: false,
      loadingCollections: false,
      collectionsError: null,
      flatCollections: [],
      selectedCollection: null
    };
  },
  computed: {
    ...mapState(['catalogUrl']),
    username() {
      return this.$store.state.user?.name || 'default';
    },
    baseUrl() {
      if (!this.catalogUrl) {
        return null;
      }
      const base = this.catalogUrl.replace(/\/+$/, '');
      return `${base}/users/${encodeURIComponent(this.username)}`;
    },
    collectionOptions() {
      const opts = [{ value: null, text: '-- Select a collection --' }];
      for (const coll of this.flatCollections) {
        opts.push({
          value: coll.id,
          text: coll.path ? `${coll.path} / ${coll.name}` : coll.name
        });
      }
      return opts;
    }
  },
  watch: {
    showModal(visible) {
      if (visible) {
        this.fetchCollections();
      }
    }
  },
  methods: {
    async fetchCollections() {
      if (!this.baseUrl) {
        this.collectionsError = 'Not authenticated or no catalog URL configured.';
        return;
      }
      this.loadingCollections = true;
      this.collectionsError = null;
      try {
        const response = await fetch(`${this.baseUrl}/tree`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }
        const data = await response.json();
        this.flatCollections = [];
        this.flattenTree(data?.roots || [], '');
      } catch (err) {
        this.collectionsError = err.message;
        this.flatCollections = [];
      } finally {
        this.loadingCollections = false;
      }
    },

    flattenTree(nodes, prefix) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          const folderPath = prefix ? `${prefix} / ${node.name}` : node.name;
          if (node.children && node.children.length > 0) {
            this.flattenTree(node.children, folderPath);
          }
        } else {
          this.flatCollections.push({
            id: node.collection_id || node.id,
            name: node.name,
            path: prefix
          });
        }
      }
    },

    async addToCollection() {
      if (!this.selectedCollection || !this.baseUrl) {
        return;
      }
      try {
        const collId = encodeURIComponent(this.selectedCollection);
        const response = await fetch(`${this.baseUrl}/collections/${collId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_ids: [this.itemId]
          })
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`API error ${response.status}: ${text}`);
        }
        this.showModal = false;
      } catch (err) {
        console.error('Failed to add item to collection:', err);
        this.collectionsError = `Failed to add item: ${err.message}`;
      }
    },

    resetForm() {
      this.selectedCollection = null;
      this.collectionsError = null;
    }
  }
};
</script>

<style lang="scss" scoped>
.add-to-collection {
  display: inline-block;
}
</style>
