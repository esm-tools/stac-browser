<template>
  <main class="personal-collections-page">
    <PersonalCollections />
  </main>
</template>

<script>
import { defineComponent } from 'vue';
import { mapState } from 'vuex';
import PersonalCollections from '../components/PersonalCollections.vue';

export default defineComponent({
  name: 'PersonalCollectionsPage',
  components: {
    PersonalCollections
  },
  computed: {
    ...mapState(['catalogUrl'])
  },
  created() {
    this.$store.commit('showPage', {
      url: null,
      page: () => ({
        title: 'My Collections'
      })
    });
  }
});
</script>

<style lang="scss" scoped>
.personal-collections-page {
  padding-top: 1rem;
}
</style>
