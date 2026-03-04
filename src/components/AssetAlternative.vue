<template>
  <div class="asset-alternative">
    <h4 class="mb-4" v-html="fileFormat" />
    <HrefActions v-if="!isCodeSnippet" isAsset :data="asset" :shown="shown" @show="show" :auth="auth" />
    <div class="mt-4" v-if="asset.description && !isCodeSnippet">
      <Description :description="asset.description" compact />
    </div>
    <div class="mt-4" v-else-if="isCodeSnippet && codeContent">
      <CodeSnippet :code="codeContent" :label="asset.title || 'Code'" :language="codeLanguage" />
    </div>
    <MetadataGroups class="mt-4" :data="resolvedAsset" :context="context" :ignoreFields="ignore" title="" type="Asset" />
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import { formatMediaType } from '@radiantearth/stac-fields/formatters';
import Description from './Description.vue';
import HrefActions from './HrefActions.vue';
import StacFieldsMixin from './StacFieldsMixin';
import AuthUtils from './auth/utils';
import { isObject, size } from 'stac-js/src/utils.js';
import { Asset, STACReference } from 'stac-js';

const CODE_SNIPPET_TYPES = [
  'text/x-python',
  'application/x-python',
  'text/x-script.python'
];

export default {
  name: 'AssetAlternative',
  components: {
    Description,
    HrefActions,
    MetadataGroups: defineAsyncComponent(() => import('./MetadataGroups.vue')),
    CodeSnippet: defineAsyncComponent(() => import('./metadata/CodeSnippet.vue'))
  },
  mixins: [
    StacFieldsMixin({ formatMediaType })
  ],
  props: {
    asset: {
      type: Object,
      required: true
    },
    hasAlternatives: {
      type: Boolean,
      default: false
    },
    shown: {
      type: Boolean,
      default: false
    }
  },
  emits: ['show'],
  data() {
    return {
      ignore: [
        // Asset fields that are handled directly
        'href',
        'title',
        'description',
        'type',
        'roles',
        // Don't show these complex lists of coordinates: https://github.com/radiantearth/stac-browser/issues/141
        'proj:bbox',
        'proj:geometry',
        // Don't show very specific options that can't be rendered nicely
        'table:storage_options',
        'xarray:open_kwargs',
        'xarray:storage_options',
        // Special handling for auth and storage
        'auth:refs',
        'storage:refs',
        // Alternative Assets are displayed separately
        'alternate',
        'alternate:name',
      ]
    };
  },
  computed: {
    context() {
      return this.asset.getContext();
    },
    resolvedAsset() {
      if (Array.isArray(this.asset['storage:refs'])) {
        const asset = new Asset(this.asset);
        asset['storage:schemes'] = this.resolveStorage(this.asset);
        return asset;
      }
      return this.asset;
    },
    tileRendererType() {
      if (this.buildTileUrlTemplate && !this.useTileLayerAsFallback) {
        return 'server';
      }
      else {
        return 'client';
      }
    },
    fileFormat() {
      if (typeof this.asset.type === "string" && this.asset.type.length > 0) {
        return this.formatMediaType(this.asset.type);
      }
      return null;
    },
    auth() {
      return AuthUtils.resolveAuth(this.asset);
    },
    isCodeSnippet() {
      return CODE_SNIPPET_TYPES.includes(this.asset.type);
    },
    codeContent() {
      if (!this.isCodeSnippet || !this.asset.description) {
        return null;
      }
      // Extract code from markdown code fences if present
      const description = this.asset.description;
      const codeBlockMatch = description.match(/```[\w]*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
      }
      // Return as-is if no code fences
      return description.trim();
    },
    codeLanguage() {
      if (this.asset.type && this.asset.type.includes('python')) {
        return 'python';
      }
      return 'text';
    }
  },
  methods: {
    resolveStorage(obj) {
      if (obj instanceof STACReference) {
        const refs = obj.getMetadata('storage:refs');
        const schemes = obj.getMetadata('storage:schemes');
        if (size(refs) > 0 && size(schemes) > 0) {
          return refs
            .map(ref => schemes[ref])
            .filter(ref => isObject(ref));
        }
      }
      return [];
    },
    show() {
      this.$emit('show', ...arguments);
    }
  }
};
</script>

<style lang="scss" scoped>
.asset-alternative {
  padding: 1rem;
}
</style>
