<template>
  <BCard no-body class="personal-collections">
    <BCardBody>
      <BCardTitle class="d-flex justify-content-between align-items-center mb-3">
        <span>Personal Collections</span>
        <div>
          <BButton size="sm" variant="outline-primary" class="me-1" @click="showNewCollectionModal = true">
            + New Collection
          </BButton>
          <BButton size="sm" variant="outline-secondary" class="me-1" @click="showNewFolderModal = true">
            + New Folder
          </BButton>
          <BButton size="sm" variant="outline-info" @click="showLabelsModal = true">
            Labels
          </BButton>
        </div>
      </BCardTitle>

      <div v-if="loading" class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="error" class="text-danger small">
        Failed to load collections: {{ error }}
      </div>

      <div v-else-if="tree.length === 0" class="text-muted small py-3 text-center">
        No collections yet. Create one to get started.
      </div>

      <div v-else class="tree-root">
        <TreeNode
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :labels="labels"
          @edit-node="openEditModal"
          @delete-node="confirmDelete"
          @share-node="openShareModal"
          @add-items="openAddItemsModal"
          @move-node="moveNode"
        />
      </div>
    </BCardBody>

    <!-- Create Collection Modal -->
    <BModal
      v-model="showNewCollectionModal"
      title="New Collection"
      @ok="createCollection"
      @hidden="resetCollectionForm"
      ok-title="Create"
      :ok-disabled="!collectionForm.name.trim()"
    >
      <BFormGroup label="Name" label-for="coll-name">
        <BFormInput id="coll-name" v-model="collectionForm.name" placeholder="Collection name" required />
      </BFormGroup>
      <BFormGroup label="Description (Markdown)" label-for="coll-desc" class="mt-2">
        <BFormTextarea id="coll-desc" v-model="collectionForm.description" rows="4" placeholder="Optional description..." />
      </BFormGroup>
      <BFormGroup label="Parent folder" label-for="coll-parent" class="mt-2">
        <BFormSelect id="coll-parent" v-model="collectionForm.parent_id" :options="folderOptions" />
      </BFormGroup>
      <BFormGroup label="Labels" class="mt-2">
        <BFormCheckboxGroup v-model="collectionForm.label_ids" :options="labelCheckboxOptions" />
      </BFormGroup>
      <div v-if="collectionForm.description" class="mt-3 border rounded p-2">
        <small class="text-muted d-block mb-1">Preview:</small>
        <div v-html="renderMarkdown(collectionForm.description)"></div>
      </div>
    </BModal>

    <!-- Create Folder Modal -->
    <BModal
      v-model="showNewFolderModal"
      title="New Folder"
      @ok="createFolder"
      @hidden="resetFolderForm"
      ok-title="Create"
      :ok-disabled="!folderForm.name.trim()"
    >
      <BFormGroup label="Name" label-for="folder-name">
        <BFormInput id="folder-name" v-model="folderForm.name" placeholder="Folder name" required />
      </BFormGroup>
      <BFormGroup label="Parent folder" label-for="folder-parent" class="mt-2">
        <BFormSelect id="folder-parent" v-model="folderForm.parent_id" :options="folderOptions" />
      </BFormGroup>
    </BModal>

    <!-- Edit Node Modal -->
    <BModal
      v-model="showEditModal"
      title="Edit"
      @ok="saveEdit"
      @hidden="resetEditForm"
      ok-title="Save"
      :ok-disabled="!editForm.name.trim()"
    >
      <BFormGroup label="Name" label-for="edit-name">
        <BFormInput id="edit-name" v-model="editForm.name" required />
      </BFormGroup>
      <BFormGroup v-if="editForm.type !== 'folder'" label="Description (Markdown)" label-for="edit-desc" class="mt-2">
        <BFormTextarea id="edit-desc" v-model="editForm.description" rows="4" />
      </BFormGroup>
      <BFormGroup v-if="editForm.type !== 'folder'" label="Labels" class="mt-2">
        <BFormCheckboxGroup v-model="editForm.label_ids" :options="labelCheckboxOptions" />
      </BFormGroup>
    </BModal>

    <!-- Delete Confirmation Modal -->
    <BModal
      v-model="showDeleteModal"
      title="Confirm Delete"
      @ok="deleteNode"
      ok-title="Delete"
      ok-variant="danger"
    >
      <p>Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?</p>
      <p v-if="deleteTarget?.type === 'folder'" class="text-warning small">
        Deleting a folder will also remove all collections inside it.
      </p>
    </BModal>

    <!-- Share Modal -->
    <BModal
      v-model="showShareModal"
      title="Share Collection"
      @ok="shareCollection"
      @hidden="resetShareForm"
      ok-title="Share"
      :ok-disabled="!shareForm.username.trim()"
    >
      <BFormGroup label="Username" label-for="share-user">
        <BFormInput id="share-user" v-model="shareForm.username" placeholder="Username to share with" />
      </BFormGroup>
      <BFormGroup label="Role" label-for="share-role" class="mt-2">
        <BFormSelect id="share-role" v-model="shareForm.role" :options="roleOptions" />
      </BFormGroup>
      <div v-if="shareTarget?.shares?.length" class="mt-3">
        <small class="text-muted">Currently shared with:</small>
        <div v-for="share in shareTarget.shares" :key="share.username" class="d-flex align-items-center mt-1">
          <BBadge variant="info" class="me-2">{{ share.username }}</BBadge>
          <small class="text-muted">{{ share.role }}</small>
          <BButton size="sm" variant="link" class="text-danger p-0 ms-2" @click="revokeShare(share.username)">
            &#10005;
          </BButton>
        </div>
      </div>
    </BModal>

    <!-- Add Items Modal -->
    <BModal
      v-model="showAddItemsModal"
      title="Add Items"
      @ok="addItems"
      @hidden="resetAddItemsForm"
      ok-title="Add"
      :ok-disabled="addItemsFormIds.length === 0"
    >
      <p class="small text-muted">
        Enter STAC item IDs (one per line) to add to <strong>{{ addItemsTarget?.name }}</strong>.
      </p>
      <BFormGroup label="Item IDs" label-for="add-items-ids">
        <BFormTextarea
          id="add-items-ids"
          v-model="addItemsRawInput"
          rows="5"
          placeholder="item-id-1&#10;item-id-2&#10;..."
        />
      </BFormGroup>
    </BModal>

    <!-- Labels Management Modal -->
    <BModal
      v-model="showLabelsModal"
      title="Manage Labels"
      ok-only
      ok-title="Close"
    >
      <div v-for="label in labels" :key="label.id" class="d-flex align-items-center mb-2">
        <BBadge
          :style="{ backgroundColor: label.color, color: contrastColor(label.color) }"
          class="me-2"
        >{{ label.name }}</BBadge>
        <BButton size="sm" variant="link" class="text-danger p-0" @click="deleteLabel(label.id)">
          &#10005;
        </BButton>
      </div>
      <hr />
      <BFormGroup label="New label" label-for="label-name">
        <div class="d-flex gap-2">
          <BFormInput id="label-name" v-model="newLabel.name" placeholder="Label name" size="sm" />
          <BFormInput type="color" v-model="newLabel.color" style="width: 3rem; padding: 0.125rem;" />
          <BButton size="sm" variant="primary" :disabled="!newLabel.name.trim()" @click="createLabel">
            Add
          </BButton>
        </div>
      </BFormGroup>
    </BModal>
  </BCard>
</template>

<script>
import { mapState } from 'vuex';
import {
  BBadge,
  BButton,
  BCard,
  BCardBody,
  BCardTitle,
  BFormCheckboxGroup,
  BFormGroup,
  BFormInput,
  BFormSelect,
  BFormTextarea,
  BModal
} from 'bootstrap-vue-next';
import { Parser, HtmlRenderer } from 'commonmark';
import TreeNode from './TreeNode.vue';

const mdParser = new Parser();
const mdRenderer = new HtmlRenderer({ safe: true });

export default {
  name: 'PersonalCollections',
  components: {
    BBadge,
    BButton,
    BCard,
    BCardBody,
    BCardTitle,
    BFormCheckboxGroup,
    BFormGroup,
    BFormInput,
    BFormSelect,
    BFormTextarea,
    BModal,
    TreeNode
  },
  data() {
    return {
      loading: false,
      error: null,
      tree: [],
      labels: [],

      // Modal visibility
      showNewCollectionModal: false,
      showNewFolderModal: false,
      showEditModal: false,
      showDeleteModal: false,
      showShareModal: false,
      showAddItemsModal: false,
      showLabelsModal: false,

      // Form state
      collectionForm: {
        name: '',
        description: '',
        parent_id: null,
        label_ids: []
      },
      folderForm: {
        name: '',
        parent_id: null
      },
      editForm: {
        id: null,
        type: null,
        name: '',
        description: '',
        label_ids: []
      },
      deleteTarget: null,
      shareTarget: null,
      shareForm: {
        username: '',
        role: 'viewer'
      },
      addItemsTarget: null,
      addItemsRawInput: '',

      newLabel: {
        name: '',
        color: '#0d6efd'
      },

      roleOptions: [
        { value: 'viewer', text: 'Viewer' },
        { value: 'developer', text: 'Developer' },
        { value: 'maintainer', text: 'Maintainer' }
      ]
    };
  },
  computed: {
    ...mapState(['catalogUrl']),
    username() {
      return this.$store.state.user?.name || null;
    },
    baseUrl() {
      if (!this.catalogUrl || !this.username) {
        return null;
      }
      const base = this.catalogUrl.replace(/\/+$/, '');
      return `${base}/users/${encodeURIComponent(this.username)}`;
    },
    folderOptions() {
      const opts = [{ value: null, text: '(root)' }];
      this.collectFolders(this.tree, opts, '');
      return opts;
    },
    labelCheckboxOptions() {
      return this.labels.map(l => ({
        value: l.id,
        text: l.name
      }));
    },
    addItemsFormIds() {
      return this.addItemsRawInput
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
  },
  watch: {
    username: {
      immediate: true,
      handler(val) {
        if (val) {
          this.fetchTree();
          this.fetchLabels();
        }
      }
    }
  },
  methods: {
    // -- API helpers --

    async apiRequest(path, options = {}) {
      if (!this.baseUrl) {
        throw new Error('Not authenticated');
      }
      const url = `${this.baseUrl}${path}`;
      const fetchOpts = {
        headers: { 'Content-Type': 'application/json' },
        ...options
      };
      const response = await fetch(url, fetchOpts);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`API error ${response.status}: ${text}`);
      }
      if (response.status === 204) {
        return null;
      }
      return response.json();
    },

    // -- Data fetching --

    async fetchTree() {
      this.loading = true;
      this.error = null;
      try {
        const data = await this.apiRequest('/tree');
        this.tree = data?.nodes || [];
      } catch (err) {
        this.error = err.message;
        this.tree = [];
      } finally {
        this.loading = false;
      }
    },

    async fetchLabels() {
      try {
        const data = await this.apiRequest('/labels');
        this.labels = Array.isArray(data) ? data : (data?.labels || []);
      } catch (err) {
        console.error('Failed to load labels:', err);
      }
    },

    // -- Collection CRUD --

    async createCollection() {
      try {
        await this.apiRequest('/collections', {
          method: 'POST',
          body: JSON.stringify({
            name: this.collectionForm.name,
            description: this.collectionForm.description,
            parent_id: this.collectionForm.parent_id,
            label_ids: this.collectionForm.label_ids
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to create collection:', err);
      }
    },

    async createFolder() {
      try {
        // Folders are created through the tree reorder endpoint
        await this.apiRequest('/tree', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'create_folder',
            name: this.folderForm.name,
            parent_id: this.folderForm.parent_id
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to create folder:', err);
      }
    },

    async saveEdit() {
      try {
        if (this.editForm.type === 'folder') {
          await this.apiRequest('/tree', {
            method: 'PATCH',
            body: JSON.stringify({
              action: 'rename',
              node_id: this.editForm.id,
              name: this.editForm.name
            })
          });
        } else {
          await this.apiRequest(`/collections/${encodeURIComponent(this.editForm.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: this.editForm.name,
              description: this.editForm.description,
              label_ids: this.editForm.label_ids
            })
          });
        }
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to save edit:', err);
      }
    },

    async deleteNode() {
      if (!this.deleteTarget) {
        return;
      }
      try {
        if (this.deleteTarget.type === 'folder') {
          await this.apiRequest('/tree', {
            method: 'PATCH',
            body: JSON.stringify({
              action: 'delete_folder',
              node_id: this.deleteTarget.id
            })
          });
        } else {
          await this.apiRequest(`/collections/${encodeURIComponent(this.deleteTarget.collection_id || this.deleteTarget.id)}`, {
            method: 'DELETE'
          });
        }
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to delete node:', err);
      }
    },

    // -- Share --

    async shareCollection() {
      if (!this.shareTarget) {
        return;
      }
      try {
        const collId = this.shareTarget.collection_id || this.shareTarget.id;
        await this.apiRequest(`/collections/${encodeURIComponent(collId)}/shares`, {
          method: 'POST',
          body: JSON.stringify({
            username: this.shareForm.username,
            role: this.shareForm.role
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to share collection:', err);
      }
    },

    async revokeShare(username) {
      if (!this.shareTarget) {
        return;
      }
      try {
        const collId = this.shareTarget.collection_id || this.shareTarget.id;
        await this.apiRequest(`/collections/${encodeURIComponent(collId)}/shares`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'revoke',
            username
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to revoke share:', err);
      }
    },

    // -- Add items --

    async addItems() {
      if (!this.addItemsTarget || this.addItemsFormIds.length === 0) {
        return;
      }
      try {
        const collId = this.addItemsTarget.collection_id || this.addItemsTarget.id;
        await this.apiRequest(`/collections/${encodeURIComponent(collId)}/items`, {
          method: 'POST',
          body: JSON.stringify({
            item_ids: this.addItemsFormIds
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to add items:', err);
      }
    },

    // -- Labels --

    async createLabel() {
      try {
        await this.apiRequest('/labels', {
          method: 'POST',
          body: JSON.stringify({
            name: this.newLabel.name,
            color: this.newLabel.color
          })
        });
        this.newLabel.name = '';
        this.newLabel.color = '#0d6efd';
        await this.fetchLabels();
      } catch (err) {
        console.error('Failed to create label:', err);
      }
    },

    async deleteLabel(labelId) {
      try {
        await this.apiRequest(`/labels/${encodeURIComponent(labelId)}`, {
          method: 'DELETE'
        });
        await this.fetchLabels();
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to delete label:', err);
      }
    },

    // -- Drag and drop --

    async moveNode({ sourceId, targetFolderId }) {
      try {
        await this.apiRequest('/tree', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'move',
            node_id: sourceId,
            target_folder_id: targetFolderId
          })
        });
        await this.fetchTree();
      } catch (err) {
        console.error('Failed to move node:', err);
      }
    },

    // -- Modal openers --

    openEditModal(node) {
      this.editForm = {
        id: node.id,
        type: node.type,
        name: node.name,
        description: node.description || '',
        label_ids: node.label_ids ? [...node.label_ids] : []
      };
      this.showEditModal = true;
    },

    confirmDelete(node) {
      this.deleteTarget = node;
      this.showDeleteModal = true;
    },

    openShareModal(node) {
      this.shareTarget = node;
      this.shareForm.username = '';
      this.shareForm.role = 'viewer';
      this.showShareModal = true;
    },

    openAddItemsModal(node) {
      this.addItemsTarget = node;
      this.addItemsRawInput = '';
      this.showAddItemsModal = true;
    },

    // -- Form resets --

    resetCollectionForm() {
      this.collectionForm = {
        name: '',
        description: '',
        parent_id: null,
        label_ids: []
      };
    },

    resetFolderForm() {
      this.folderForm = { name: '', parent_id: null };
    },

    resetEditForm() {
      this.editForm = { id: null, type: null, name: '', description: '', label_ids: [] };
    },

    resetShareForm() {
      this.shareTarget = null;
      this.shareForm = { username: '', role: 'viewer' };
    },

    resetAddItemsForm() {
      this.addItemsTarget = null;
      this.addItemsRawInput = '';
    },

    // -- Utilities --

    collectFolders(nodes, opts, prefix) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          opts.push({ value: node.id, text: `${prefix}${node.name}` });
          if (node.children && node.children.length > 0) {
            this.collectFolders(node.children, opts, `${prefix}${node.name} / `);
          }
        }
      }
    },

    renderMarkdown(text) {
      if (!text) {
        return '';
      }
      const parsed = mdParser.parse(text);
      return mdRenderer.render(parsed);
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
.personal-collections {
  .tree-root {
    max-height: 60vh;
    overflow-y: auto;
  }
}
</style>
