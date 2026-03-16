<template>
  <div class="item" :key="data.id">
    <b-row>
      <b-col class="left">
        <section class="mb-4">
          <b-card no-body class="maps-preview">
            <b-tabs v-model="tab" ref="tabs" card pills vertical end>
              <!-- Preview tab: only when vizServer is available -->
              <b-tab v-if="vizServer" :title="$t('dataPreview') || 'Preview'" no-body>
                <DataPreview
                  :item="data"
                  :viz-server="vizServer"
                  :stac-api="stacApi"
                />
              </b-tab>
              <!-- Thumbnails tab -->
              <b-tab v-if="hasThumbnails" :title="$t('thumbnails')" no-body>
                <Thumbnails :thumbnails="thumbnails" />
              </b-tab>
              <!-- Map tab: fallback when vizServer is NOT available -->
              <b-tab v-if="!vizServer" :title="$t('map')" no-body>
                <MapView :stac="data" :assets="selectedAssets" @changed="dataChanged" @empty="handleEmptyMap" />
              </b-tab>
            </b-tabs>
          </b-card>
        </section>
        <Assets v-if="hasAssets" :assets="assets" :context="data" :shown="selectedReferences" @show-asset="showAsset" />
        <LinkList v-if="additionalLinks.length > 0" :title="$t('additionalResources')" :links="additionalLinks" :context="data" />
      </b-col>
      <b-col class="right">
        <section class="intro">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h2 v-if="data.properties.description">{{ $t('description') }}</h2>
            <AddToCollection v-if="data.id" :item-id="data.id" />
          </div>
          <DeprecationNotice v-if="showDeprecation" :data="data" />
          <AnonymizedNotice v-if="data.properties['anon:warning']" :warning="data.properties['anon:warning']" />
          <ReadMore v-if="data.properties.description" :lines="10" :text="$t('read.more')" :text-less="$t('read.less')">
            <Description :description="data.properties.description" />
          </ReadMore>
          <Keywords v-if="Array.isArray(data.properties.keywords) && data.properties.keywords.length > 0" :keywords="data.properties.keywords" class="mb-3" />
        </section>
        <CollectionLink v-if="collectionLink" :link="collectionLink" />
        <Providers v-if="data.properties.providers" :providers="data.properties.providers" />
        <MetadataGroups :data="data" type="Item" :ignoreFields="ignoredMetadataFields" />
      </b-col>
    </b-row>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from 'vue';
import { mapState, mapGetters } from 'vuex';
import { BTab, BTabs, BCard } from 'bootstrap-vue-next';
import Description from '../components/Description.vue';
import ReadMore from "../components/ReadMore.vue";
import ShowAssetLinkMixin from '../components/ShowAssetLinkMixin';
import DeprecationMixin from '../components/DeprecationMixin';
import { addSchemaToDocument, createItemSchema } from '../schema-org';

export default defineComponent({
  name: "Item",
  components: {
    BTab,
    BTabs,
    BCard,
    AddToCollection: defineAsyncComponent(() => import('../components/AddToCollection.vue')),
    AnonymizedNotice: defineAsyncComponent(() => import('../components/AnonymizedNotice.vue')),
    Assets: defineAsyncComponent(() => import('../components/Assets.vue')),
    CollectionLink: defineAsyncComponent(() => import('../components/CollectionLink.vue')),
    DataPreview: defineAsyncComponent(() => import('../components/DataPreview.vue')),
    Description,
    DeprecationNotice: defineAsyncComponent(() => import('../components/DeprecationNotice.vue')),
    Keywords: defineAsyncComponent(() => import('../components/Keywords.vue')),
    LinkList: defineAsyncComponent(() => import('../components/LinkList.vue')),
    MapView: defineAsyncComponent(() => import('../components/MapView.vue')),
    MetadataGroups: defineAsyncComponent(() => import('../components/MetadataGroups.vue')),
    Providers: defineAsyncComponent(() => import('../components/Providers.vue')),
    ReadMore,
    Thumbnails: defineAsyncComponent(() => import('../components/Thumbnails.vue'))
  },
  mixins: [
    ShowAssetLinkMixin,
    DeprecationMixin
  ],
  data() {
    return {
      ignoredMetadataFields: [
        'description',
        'keywords',
        'providers',
        'title',
        // Will be rendered with a custom rendered
        'deprecated',
        // Don't show these complex lists of coordinates: https://github.com/radiantearth/stac-browser/issues/141
        'proj:bbox',
        'proj:geometry',
        // Special handling for auth
        'auth:schemes',
        // Special handling for the warning of the anonymized-location extension
        'anon:warning'
      ]
    };
  },
  computed: {
    ...mapState(['data', 'url', 'catalogUrl', 'vizServer']),
    ...mapGetters(['collectionLink', 'parentLink']),
    stacApi() {
      // Use catalogUrl as the STAC API endpoint
      return this.catalogUrl || '';
    }
  },
  watch: {
    data: {
      immediate: true,
      handler(data) {
        try {
          let schema = createItemSchema(data, [this.collectionLink, this.parentLink], this.$store);
          addSchemaToDocument(document, schema);
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
});
</script>

<style lang="scss">
@import 'bootstrap/scss/mixins';
@import "../theme/variables.scss";

#stac-browser .item {
  .left, .right {
    max-width: 50%;
    @include media-breakpoint-down(sm) {
      max-width: 100%;
      min-width: 100%;
    }
  }

  .metadata .card-columns {
    column-count: 1;

    &:not(.count-1) {
      @include media-breakpoint-up(xxxl) {
        column-count: 2;
      }
    }
  }
}
</style>
