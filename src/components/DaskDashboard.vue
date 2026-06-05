<template>
  <BCard no-body class="dask-dashboard">
    <BCardBody>
      <BCardTitle class="d-flex justify-content-between align-items-center mb-3">
        <span>Dask Compute Clusters</span>
        <div class="d-flex align-items-center gap-2">
          <small v-if="lastRefresh" class="text-muted">Updated {{ lastRefreshLabel }}</small>
          <BButton size="sm" variant="outline-secondary" @click="fetchClusters" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
            Refresh
          </BButton>
          <BButton size="sm" variant="outline-primary" @click="openCreateModal">+ New Cluster</BButton>
        </div>
      </BCardTitle>

      <div v-if="!vizServer" class="text-warning small py-3 text-center">
        No visualization server configured.
      </div>

      <div v-else-if="loading && clusters.length === 0" class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-primary"></div>
      </div>

      <div v-else-if="error" class="text-danger small py-2">Failed to load clusters: {{ error }}</div>

      <div v-else-if="clusters.length === 0" class="text-muted small py-4 text-center">
        No active clusters. Create one to enable distributed compute.
      </div>

      <div v-else class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Name / ID</th>
              <th>Type</th>
              <th>Workers</th>
              <th>Status</th>
              <th>Dashboard</th>
              <th>Scale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cluster in clusters" :key="cluster.id">
              <td>
                <div class="fw-semibold small">{{ cluster.name || cluster.id }}</div>
                <div v-if="cluster.name" class="text-muted" style="font-size: 0.7rem; font-family: monospace;">{{ cluster.id }}</div>
              </td>
              <td><BBadge variant="secondary" class="text-uppercase" style="font-size: 0.65rem;">{{ cluster.type || 'local' }}</BBadge></td>
              <td class="text-center fw-semibold">{{ cluster.workers ?? '&mdash;' }}</td>
              <td><BBadge :variant="statusVariant(cluster.status)">{{ cluster.status || 'unknown' }}</BBadge></td>
              <td>
                <a v-if="cluster.dashboard_url" :href="cluster.dashboard_url" target="_blank" class="btn btn-sm btn-outline-info py-0 px-2" style="font-size: 0.75rem;">Open</a>
                <span v-else class="text-muted small">&mdash;</span>
              </td>
              <td style="min-width: 200px;">
                <div v-if="cluster.type !== 'existing' && scaleTargets[cluster.id]" class="d-flex align-items-center gap-1">
                  <BFormInput type="number" size="sm" v-model.number="scaleTargets[cluster.id].workers" :min="1" style="width: 5rem;" />
                  <BButton size="sm" variant="outline-primary" class="py-0 px-2" @click="applyScale(cluster)" :disabled="scalingIds.has(cluster.id)">Scale</BButton>
                </div>
                <span v-else class="text-muted small">n/a</span>
              </td>
              <td class="text-end">
                <BButton size="sm" variant="outline-danger" class="py-0 px-2" @click="confirmDelete(cluster)">&#10005;</BButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BCardBody>

    <!-- Create Modal -->
    <BModal v-model="showCreateModal" title="New Dask Cluster" @ok.prevent="handleCreate" ok-title="Create" :ok-disabled="!canSubmitCreate || creating" size="lg">
      <BFormGroup label="Cluster type" class="mb-3">
        <BFormSelect v-model="createForm.type" :options="clusterTypeOptions" />
      </BFormGroup>
      <BFormGroup label="Name (optional)" class="mb-3">
        <BFormInput v-model="createForm.name" placeholder="my-cluster" />
      </BFormGroup>

      <template v-if="createForm.type === 'local'">
        <BFormGroup label="Workers" class="mb-3">
          <BFormInput type="number" v-model.number="createForm.workers" :min="1" placeholder="4" />
        </BFormGroup>
        <BFormGroup label="Memory per worker" class="mb-3">
          <BFormInput v-model="createForm.memory" placeholder="2GB" />
        </BFormGroup>
      </template>

      <template v-if="createForm.type === 'slurm'">
        <div class="row g-3 mb-3">
          <div class="col-sm-6"><BFormGroup label="Cores"><BFormInput type="number" v-model.number="createForm.cores" :min="1" placeholder="4" /></BFormGroup></div>
          <div class="col-sm-6"><BFormGroup label="Memory"><BFormInput v-model="createForm.memory" placeholder="8GB" /></BFormGroup></div>
          <div class="col-sm-6"><BFormGroup label="Queue"><BFormInput v-model="createForm.queue" placeholder="compute" /></BFormGroup></div>
          <div class="col-sm-6"><BFormGroup label="Workers"><BFormInput type="number" v-model.number="createForm.workers" :min="1" placeholder="4" /></BFormGroup></div>
        </div>
      </template>

      <template v-if="createForm.type === 'gateway'">
        <BFormGroup label="Gateway URL" class="mb-3">
          <BFormInput v-model="createForm.gateway_url" placeholder="http://dask-gateway:8000" />
        </BFormGroup>
        <BFormGroup label="Workers" class="mb-3">
          <BFormInput type="number" v-model.number="createForm.workers" :min="1" placeholder="4" />
        </BFormGroup>
      </template>

      <template v-if="createForm.type === 'existing'">
        <BFormGroup label="Scheduler address" class="mb-3">
          <BFormInput v-model="createForm.scheduler_address" placeholder="tcp://scheduler:8786" />
        </BFormGroup>
      </template>

      <div v-if="createError" class="alert alert-danger mt-3 mb-0 small py-2">{{ createError }}</div>
    </BModal>

    <!-- Delete Modal -->
    <BModal v-model="showDeleteModal" title="Shut Down Cluster" @ok="deleteCluster" ok-title="Shut Down" ok-variant="danger">
      <p>Shut down <strong>{{ deleteTarget?.name || deleteTarget?.id }}</strong>?</p>
    </BModal>
  </BCard>
</template>

<script>
import { mapState } from 'vuex';
import { BBadge, BButton, BCard, BCardBody, BCardTitle, BFormGroup, BFormInput, BFormSelect, BModal } from 'bootstrap-vue-next';

export default {
  name: 'DaskDashboard',
  components: { BBadge, BButton, BCard, BCardBody, BCardTitle, BFormGroup, BFormInput, BFormSelect, BModal },
  data() {
    return {
      loading: false, creating: false, error: null, clusters: [],
      lastRefresh: null, pollTimer: null, scaleTargets: {}, scalingIds: new Set(),
      showCreateModal: false, showDeleteModal: false, deleteTarget: null, createError: null,
      createForm: { type: 'local', name: '', workers: null, memory: '', cores: null, queue: '', gateway_url: '', scheduler_address: '' },
      clusterTypeOptions: [
        { value: 'local', text: 'Local (same machine)' },
        { value: 'slurm', text: 'SLURM (HPC batch)' },
        { value: 'gateway', text: 'Dask Gateway' },
        { value: 'existing', text: 'Existing scheduler (TCP)' }
      ]
    };
  },
  computed: {
    ...mapState(['vizServer']),
    canSubmitCreate() {
      if (!this.createForm.type) return false;
      if (this.createForm.type === 'gateway') return !!this.createForm.gateway_url.trim();
      if (this.createForm.type === 'existing') return !!this.createForm.scheduler_address.trim();
      return true;
    },
    lastRefreshLabel() {
      if (!this.lastRefresh) return '';
      const diff = Math.round((Date.now() - this.lastRefresh) / 1000);
      return diff < 5 ? 'just now' : diff < 60 ? `${diff}s ago` : `${Math.round(diff / 60)}m ago`;
    }
  },
  mounted() {
    if (this.vizServer) { this.fetchClusters(); this.startPolling(); }
  },
  beforeUnmount() { this.stopPolling(); },
  watch: {
    vizServer(val) {
      if (val) { this.fetchClusters(); this.startPolling(); }
      else { this.stopPolling(); this.clusters = []; }
    }
  },
  methods: {
    computeUrl(path) { return `${this.vizServer.replace(/\/+$/, '')}${path}`; },
    async apiRequest(path, opts = {}) {
      const r = await fetch(this.computeUrl(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text().catch(() => '')}`);
      return r.status === 204 ? null : r.json();
    },
    async fetchClusters() {
      if (!this.vizServer) return;
      this.loading = true; this.error = null;
      try {
        const data = await this.apiRequest('/compute/clusters');
        this.clusters = Array.isArray(data) ? data : (data?.clusters || []);
        this.syncScaleTargets();
        this.lastRefresh = Date.now();
      } catch (e) { this.error = e.message; }
      finally { this.loading = false; }
    },
    syncScaleTargets() {
      const next = {};
      for (const c of this.clusters) {
        next[c.id] = this.scaleTargets[c.id] || { workers: c.workers ?? 1 };
      }
      this.scaleTargets = next;
    },
    startPolling() { this.stopPolling(); this.pollTimer = setInterval(() => this.fetchClusters(), 10000); },
    stopPolling() { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } },
    openCreateModal() { this.createForm = { type: 'local', name: '', workers: null, memory: '', cores: null, queue: '', gateway_url: '', scheduler_address: '' }; this.createError = null; this.showCreateModal = true; },
    async handleCreate(e) {
      if (e?.preventDefault) e.preventDefault();
      this.createError = null; this.creating = true;
      try {
        const f = this.createForm;
        const payload = { type: f.type };
        if (f.name.trim()) payload.name = f.name.trim();
        if (f.workers) payload.workers = f.workers;
        if (f.memory?.trim()) payload.memory = f.memory.trim();
        if (f.cores) payload.cores = f.cores;
        if (f.queue?.trim()) payload.queue = f.queue.trim();
        if (f.gateway_url?.trim()) payload.gateway_url = f.gateway_url.trim();
        if (f.scheduler_address?.trim()) payload.scheduler_address = f.scheduler_address.trim();
        await this.apiRequest('/compute/clusters', { method: 'POST', body: JSON.stringify(payload) });
        this.showCreateModal = false;
        await this.fetchClusters();
      } catch (e) { this.createError = e.message; }
      finally { this.creating = false; }
    },
    async applyScale(cluster) {
      this.scalingIds = new Set([...this.scalingIds, cluster.id]);
      try {
        const t = this.scaleTargets[cluster.id];
        await this.apiRequest(`/compute/clusters/${encodeURIComponent(cluster.id)}`, { method: 'PATCH', body: JSON.stringify({ workers: t.workers }) });
        await this.fetchClusters();
      } catch (e) { console.error('Scale failed:', e); }
      finally { const s = new Set(this.scalingIds); s.delete(cluster.id); this.scalingIds = s; }
    },
    confirmDelete(cluster) { this.deleteTarget = cluster; this.showDeleteModal = true; },
    async deleteCluster() {
      if (!this.deleteTarget) return;
      const id = this.deleteTarget.id; this.deleteTarget = null;
      try { await this.apiRequest(`/compute/clusters/${encodeURIComponent(id)}`, { method: 'DELETE' }); await this.fetchClusters(); }
      catch (e) { console.error('Delete failed:', e); }
    },
    statusVariant(s) {
      switch ((s || '').toLowerCase()) {
        case 'running': return 'success';
        case 'scaling': case 'starting': case 'pending': return 'warning';
        case 'error': case 'failed': return 'danger';
        default: return 'secondary';
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.dask-dashboard { .table td, .table th { vertical-align: middle; } }
</style>
