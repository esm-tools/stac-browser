<template>
  <main class="dask-dashboard-page">
    <DaskDashboard />
  </main>
</template>

<script>
import { defineComponent } from 'vue';
import DaskDashboard from '../components/DaskDashboard.vue';

export default defineComponent({
  name: 'DaskDashboardPage',
  components: {
    DaskDashboard
  },
  created() {
    this.$store.commit('showPage', {
      url: null,
      page: () => ({
        title: 'Compute Clusters'
      })
    });
  }
});
</script>

<style lang="scss" scoped>
.dask-dashboard-page {
  padding-top: 1rem;
}
</style>
