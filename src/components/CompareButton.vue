<template>
  <div v-if="canCompare" class="compare-fab">
    <b-button variant="primary" size="lg" @click="openComparison">
      Compare ({{ selectionCount }})
    </b-button>
    <b-button variant="outline-secondary" size="sm" class="ms-2" @click="clearSelections">
      Clear
    </b-button>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: 'CompareButton',
  computed: {
    ...mapGetters('comparison', ['selectionCount', 'canCompare'])
  },
  methods: {
    ...mapActions('comparison', ['openComparison', 'clearSelections']),
    clearSelections() {
      this.$store.commit('comparison/clearSelections');
    }
  }
};
</script>

<style lang="scss" scoped>
.compare-fab {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1050;
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
