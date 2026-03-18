<template>
  <b-form class="filter mb-4" @submit.stop.prevent="onSubmit" @reset="onReset">
    <b-card no-body :title="title">
      <b-card-body>
        <Loading v-if="!loaded" fill />

        <b-card-title v-if="title" :title="title" />

        <b-form-group v-if="canFilterFreeText" class="filter-freetext" :label="$t('search.freeText')" :label-for="ids.q" :description="$t('search.freeTextDescription')">
          <multiselect
            :id="ids.q"
            v-model="query.q"
            multiple taggable
            :options="query.q"
            :placeholder="$t('search.enterSearchTerms')"
            :tag-placeholder="$t('search.addSearchTerm')"
            :no-options="$t('search.addSearchTerm')"
            @tag="addSearchTerm"
          >
            <template #noOptions>{{ $t('search.noOptions') }}</template>
          </multiselect>
        </b-form-group>

        <b-form-group v-if="canFilterExtents" class="filter-datetime" :label="$t('search.temporalExtent')" :label-for="ids.datetime" :description="$t('search.dateDescription')">
          <VueDatePicker
            input-class="form-control mx-input"
            :id="ids.datetime" 
            v-model="datetime"
            :locale="datepickerLang"
            :formats="{ input: dateTimeFormat }"
            :week-start="weekStartDay"
            :close-on-scroll="false"
            :placeholder="$t('search.selectDateRange')"
            :time-config="{ 
              enableTimePicker: true, 
              seconds: true,
              timePickerInline: true 
            }"
            :input-attrs="{ clearable: true }"
            auto-apply
            range
            :multi-calendars="2"
          />
        </b-form-group>

        <!-- NOTE: Spatial Extent removed - all climate models are global -->
        <!-- May be re-added for paleoclimate proxy data -->

        <!-- Climate Scientist Quick Filters -->
        <b-form-group v-if="showQuickFilters" class="quick-filters" label="Quick Filters">
          <!-- Model Components -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">Model Components</label>
            <div class="d-flex flex-wrap gap-1">
              <b-form-checkbox-group
                v-model="selectedComponents"
                :options="availableComponents"
                buttons
                button-variant="outline-primary"
                size="sm"
              />
            </div>
          </div>

          <!-- CO2 Level (ppm) -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">CO2 Level (ppm)</label>
            <div class="d-flex align-items-center gap-2">
              <b-form-input
                v-model.number="co2Min"
                type="number"
                size="sm"
                placeholder="Min"
                style="width: 80px"
              />
              <span class="text-muted">to</span>
              <b-form-input
                v-model.number="co2Max"
                type="number"
                size="sm"
                placeholder="Max"
                style="width: 80px"
              />
              <div class="quick-presets ms-2">
                <b-button size="sm" variant="outline-secondary" @click="setCO2Preset('preindustrial')">PI (284)</b-button>
                <b-button size="sm" variant="outline-secondary" @click="setCO2Preset('2xco2')">2xCO2</b-button>
                <b-button size="sm" variant="outline-secondary" @click="setCO2Preset('4xco2')">4xCO2</b-button>
              </div>
            </div>
          </div>

          <!-- CH4 Level (ppb) -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">CH4 Level (ppb)</label>
            <div class="d-flex align-items-center gap-2">
              <b-form-input
                v-model.number="ch4Min"
                type="number"
                size="sm"
                placeholder="Min"
                style="width: 80px"
              />
              <span class="text-muted">to</span>
              <b-form-input
                v-model.number="ch4Max"
                type="number"
                size="sm"
                placeholder="Max"
                style="width: 80px"
              />
            </div>
          </div>

          <!-- N2O Level (ppb) -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">N2O Level (ppb)</label>
            <div class="d-flex align-items-center gap-2">
              <b-form-input
                v-model.number="n2oMin"
                type="number"
                size="sm"
                placeholder="Min"
                style="width: 80px"
              />
              <span class="text-muted">to</span>
              <b-form-input
                v-model.number="n2oMax"
                type="number"
                size="sm"
                placeholder="Max"
                style="width: 80px"
              />
            </div>
          </div>

          <!-- Paleo Time Presets -->
          <div v-if="paleoPresets.length > 0" class="quick-filter-row mb-2">
            <label class="small fw-bold">Paleo Time Period</label>
            <div class="d-flex flex-wrap gap-1 mb-1">
              <b-button
                v-for="preset in paleoPresets"
                :key="preset.id"
                size="sm"
                :variant="selectedPaleoPreset === preset.id ? 'info' : 'outline-info'"
                :title="preset.description"
                @click="selectPaleoPreset(preset)"
              >{{ preset.name }}</b-button>
              <b-button
                v-if="selectedPaleoPreset"
                size="sm"
                variant="outline-danger"
                @click="clearPaleoPreset"
              >Clear</b-button>
            </div>
          </div>

          <!-- Experiment Type -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">Experiment Type</label>
            <div class="d-flex flex-wrap gap-1">
              <b-form-checkbox-group
                v-model="selectedExperimentTypes"
                :options="experimentTypeOptions"
                buttons
                button-variant="outline-secondary"
                size="sm"
              />
            </div>
          </div>

          <!-- Output Frequency -->
          <div class="quick-filter-row mb-2">
            <label class="small fw-bold">Output Frequency</label>
            <div class="d-flex flex-wrap gap-1">
              <b-form-checkbox-group
                v-model="selectedFrequencies"
                :options="frequencyOptions"
                buttons
                button-variant="outline-success"
                size="sm"
              />
            </div>
          </div>
        </b-form-group>

        <b-form-group v-if="conformances.CollectionIdFilter" class="filter-collection" :label="$t('stacCollection', collections.length)" :label-for="ids.collections">
          <multiselect
            :id="ids.collections"
            v-model="selectedCollections"
            v-bind="collectionSelectOptions"
            @tag="addCollection"
            @search-change="searchCollections"
          >
            <template #noOptions>{{ $t('search.noOptions') }}</template>
            <template v-if="additionalCollectionCount > 0" #afterList>
              <li>
                <strong class="multiselect__option multiselect__option--disabled">
                  {{ $t("multiselect.andMore", {count: additionalCollectionCount}) }}
                </strong>
              </li>
            </template>
          </multiselect>
        </b-form-group>

        <b-form-group v-if="conformances.ItemIdFilter" class="filter-item-id" :label="$t('search.itemIds')" :label-for="ids.ids">
          <multiselect
            :id="ids.ids"
            v-model="query.ids"
            multiple taggable
            :options="query.ids"
            :placeholder="$t('search.enterItemIds')"
            :tag-placeholder="$t('search.addItemIds')"
            :no-options="$t('search.addItemIds')"
            @tag="addId"
          >
            <template #noOptions>{{ $t('search.noOptions') }}</template>
          </multiselect>
        </b-form-group>

        <b-form-group v-if="showAdditionalFilters" class="additional-filters" :label="$t('search.additionalFilters')">
          <b-form-radio-group v-model="filtersAndOr" :options="andOrOptions" name="logical" size="sm" />
          <b-form-checkbox v-model="filtersNegate" size="sm">{{ $t('search.logical.not') }}</b-form-checkbox>

          <b-dropdown size="sm" :text="$t('search.addFilter')" variant="primary" class="queryables mt-2 mb-3" menu-class="w-100 queryables-menu" toggle-class="w-100">
            <!-- Fuzzy search input for filtering queryables -->
            <div class="queryables-search px-2 py-1 border-bottom sticky-top bg-white">
              <b-form-input
                v-model="queryableSearchTerm"
                type="text"
                size="sm"
                :placeholder="$t('search.filterProperties') || 'Filter properties...'"
                @click.stop
              />
            </div>

            <!-- Grouped queryables for namelist parameters -->
            <template v-if="hasNamelistGroups">
              <div v-for="group in queryableGroups" :key="group.name" class="queryable-group">
                <div
                  class="queryable-group-header px-3 py-1 bg-light border-bottom d-flex align-items-center cursor-pointer"
                  @click.stop="toggleQueryableGroup(group.name)"
                >
                  <span class="group-toggle me-2">{{ expandedQueryableGroups[group.name] ? '[-]' : '[+]' }}</span>
                  <strong>{{ group.title }}</strong>
                  <b-badge variant="secondary" class="ms-auto">{{ group.queryables.length }}</b-badge>
                </div>
                <template v-if="expandedQueryableGroups[group.name]">
                  <b-dropdown-item
                    v-for="queryable in group.queryables"
                    :key="queryable.id"
                    @click="additionalFieldSelected(queryable)"
                    link-class="d-flex justify-content-between align-items-center ps-4"
                  >
                    <span>{{ queryable.title }}</span>
                    <b-badge variant="dark" class="ms-2">{{ queryable.shortId || queryable.id }}</b-badge>
                  </b-dropdown-item>
                </template>
              </div>
            </template>

            <!-- Flat list for non-grouped queryables or when no groups -->
            <template v-for="queryable in filteredUngroupedQueryables" :key="queryable.id">
              <b-dropdown-item v-if="queryable.supported" @click="additionalFieldSelected(queryable)" link-class="d-flex justify-content-between align-items-center">
                <span>{{ queryable.title }}</span>
                <b-badge variant="dark" class="ms-2">{{ queryable.id }}</b-badge>
              </b-dropdown-item>
            </template>

            <!-- No results message -->
            <div v-if="filteredQueryablesEmpty" class="px-3 py-2 text-muted">
              {{ $t('search.noMatchingProperties') || 'No matching properties' }}
            </div>
          </b-dropdown>

          <QueryableInput
            v-for="(filter, index) in filters" :key="filter.id"
            v-model:value="filter.value"
            v-model:operator="filter.operator"
            v-model:negate="filter.negate"
            :queryable="filter.queryable"
            :index="index"
            :cql="cql"
            @remove-queryable="removeQueryable(index)"
          />
        </b-form-group>

        <hr v-if="canFilterExtents || conformances.CollectionIdFilter || conformances.ItemIdFilter || showAdditionalFilters">

        <b-form-group v-if="canSort" class="sort" :label="$t('sort.title')" :label-for="ids.sort" :description="$t('search.notFullySupported')">
          <multiselect
            :id="ids.sort"
            v-model="sortTerm"
            :options="sortOptions"
            track-by="value"
            label="text"
            :placeholder="$t('default')"
            :select-label="$t('multiselect.selectLabel')"
            :selected-label="$t('multiselect.selectedLabel')"
            :deselect-label="$t('multiselect.deselectLabel')"
          >
            <template #option="{option}">
              <span class="d-flex justify-content-between align-items-center">
                <span>{{ option.text }}</span>
                <b-badge v-if="option.value" variant="dark" class="ms-2">{{ option.value }}</b-badge>
              </span>
            </template>
          </multiselect>
          <SortButtons v-if="sortTerm && sortTerm.value" class="mt-1" v-model="sortOrder" :enforce="true" />
        </b-form-group>

        <b-form-group class="limit" :label="$t('search.itemsPerPage')" :label-for="ids.limit" :description="$t('search.itemsPerPageDescription', {maxItems})">
          <b-form-input
            :id="ids.limit" :model-value="query.limit" @update:model-value="setLimit" min="1"
            :max="maxItems" type="number"
            :placeholder="limitPlaceholder"
          />
        </b-form-group>
      </b-card-body>
      <b-card-footer>
        <b-button type="submit" variant="primary">{{ $t('submit') }}</b-button>
        <b-button type="reset" variant="danger" class="ms-3">{{ $t('reset') }}</b-button>
      </b-card-footer>
    </b-card>
  </b-form>
</template>

<script>
import { defineComponent, defineAsyncComponent } from 'vue';
import { mapGetters, mapState } from "vuex";
import { BCard, BCardBody, BCardFooter, BCardTitle, BDropdown, BDropdownItem } from 'bootstrap-vue-next';

import refParser from '@apidevtools/json-schema-ref-parser';

import Utils from '../utils';
import { hasText, isObject } from 'stac-js/src/utils.js';

import ApiCapabilitiesMixin, { TYPES } from './ApiCapabilitiesMixin';
import DatePickerMixin from './DatePickerMixin';
import Loading from './Loading.vue';

import { CollectionCollection, STAC } from 'stac-js'; 
import { createSTAC, Collection } from '../models/stac';
import Cql from '../models/cql2/cql';
import Queryable from '../models/cql2/queryable';
import CqlLogicalOperator, { CqlNot, CqlAnd } from '../models/cql2/operators/logical';
import { CqlGreaterThanEqual, CqlLessThanEqual, CqlLike } from '../models/cql2/operators/comparison';
import { CqlIn } from '../models/cql2/operators/array';
import CqlValue from '../models/cql2/value';
import { stacRequest } from '../store/utils';

function getQueryDefaults() {
  return {
    q: [],
    datetime: null,
    bbox: null,
    limit: null,
    ids: [],
    collections: [],
    sortby: null,
    filters: null
  };
}

function getDefaults() {
  return {
    sortOrder: 1,
    sortTerm: null,
    provideBBox: false,
    // Store previous bbox so that it survives when the map is temporarily hidden
    bbox: null,
    query: getQueryDefaults(),
    filtersAndOr: 'and',
    filtersNegate: false,
    filters: [],
    selectedCollections: [],
    // Quick filter defaults (for reset)
    selectedComponents: [],
    co2Min: null,
    co2Max: null,
    ch4Min: null,
    ch4Max: null,
    n2oMin: null,
    n2oMax: null,
    selectedExperimentTypes: [],
    selectedFrequencies: [],
    selectedPaleoPreset: null
  };
}

let formId = 0;

export default defineComponent({
  name: 'SearchFilter',
  components: {
    Loading,
    BCard,
    BCardBody,
    BCardFooter,
    BCardTitle,
    BDropdown,
    BDropdownItem,
    QueryableInput: defineAsyncComponent(() => import('./QueryableInput.vue')),
    MapSelect: defineAsyncComponent(() => import('./maps/MapSelect.vue')),
    SortButtons: defineAsyncComponent(() => import('./SortButtons.vue')),
    Multiselect: defineAsyncComponent(() => import('vue-multiselect')),
  },
  mixins: [
    ApiCapabilitiesMixin,
    DatePickerMixin
  ],
  props: {
    parent: {
      type: Object,
      default: null
    },
    title: {
      type: String,
      required: true
    },
    type: { // Collections or Global or Items
      type: String,
      required: true
    },
    value: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['input'],
  data() {
    return Object.assign({
      results: null,
      loaded: false,
      queryables: null,
      hasAllCollections: false,
      collections: [],
      collectionsLoadingTimer: null,
      additionalCollectionCount: 0,
      // Queryable search and grouping
      queryableSearchTerm: '',
      expandedQueryableGroups: {},
      // Quick filters for climate scientists
      selectedComponents: [],
      co2Min: null,
      co2Max: null,
      ch4Min: null,
      ch4Max: null,
      n2oMin: null,
      n2oMax: null,
      selectedExperimentTypes: [],
      selectedFrequencies: [],
      paleoPresets: [
        { id: 'lgm', name: 'LGM', display: '21.0 ka', years_bp: 21000, description: 'Last Glacial Maximum' },
        { id: 'mid_holocene', name: 'Mid-Holocene', display: '6.0 ka', years_bp: 6000, description: 'Mid-Holocene warm period' },
        { id: 'eemian', name: 'Eemian', display: '125.0 ka', years_bp: 125000, description: 'Last Interglacial' },
        { id: 'preindustrial', name: 'PI', display: '1850 CE', years_bp: 100, description: 'Pre-industrial' }
      ],
      selectedPaleoPreset: null
    }, getDefaults());
  },
  computed: {
    ...mapState(['searchResultsPerPage', 'maxEntriesPerPage', 'uiLanguage']),
    ...mapGetters(['canSearchCollections', 'supportsConformance']),
    collectionSelectOptions() {
      let taggable = !this.hasAllCollections;
      let isResult = this.collections.length > 0 && !this.hasAllCollections;
      return {
        id: this.ids.collections,
        multiple: true,
        taggable,
        options: this.collections, // query.collections
        trackBy: "value",
        label: "text",
        placeholder: taggable ? this.$t('search.enterCollections') : this.$t('search.selectCollections'),
        tagPlaceholder: this.$t('search.addCollections'),
        selectLabel: this.$t('multiselect.selectLabel'),
        selectedLabel: this.$t('multiselect.selectedLabel'),
        deselectLabel: this.$t('multiselect.deselectLabel'),
        limitText: count => this.$t("multiselect.andMore", {count}),
        loading: this.collectionsLoadingTimer !== null,
        showNoResults: false,
        internalSearch: !isResult
      };
    },
    collectionSearchLink() {
      return this.parent && this.parent.isCatalogLike() && this.parent.getApiCollectionsLink();
    },
    canSearchCollectionsFreeText() {
      return this.canSearchCollections && this.supportsConformance(TYPES.Collections.FreeText);
    },
    ids() {
      let obj = {};
      ['q', 'datetime', 'bbox', 'collections', 'ids', 'sort', 'limit']
        .forEach(field => obj[field] = field + formId);
      return obj;
    },
    stac() {
      if (this.parent instanceof STAC) {
        return this.parent;
      }
      return null;
    },
    andOrOptions() {
      return [
        { value: 'and', text: this.$t('search.logical.and') },
        { value: 'or', text: this.$t('search.logical.or') },
      ];
    },
    showAdditionalFilters() {
      return this.cql && Array.isArray(this.queryables) && this.queryables.length > 0;
    },
    sortOptions() {
      // todo: this should use queryables when available
      // nevertheless, let's try to provide some reasonable defaults
      const criteria = [
        { text: this.$t('default'), value: null },
        { text: this.$t('fields.Identifier'), value: 'id' },
      ];
      const prefix = this.type === 'Collections' ? '' : 'properties.';
      criteria.push({ text: this.$t('fields.Title'), value: `${prefix}title` });
      if (this.type !== 'Collections') {
        criteria.push({ text: this.$t('fields.Time of Data'), value: 'properties.datetime' });
      }
      criteria.push({ text: this.$t('fields.Created'), value: `${prefix}created` });
      criteria.push({ text: this.$t('fields.Updated'), value: `${prefix}updated` });
      return criteria;
    },
    sortedQueryables() {
      if (!Array.isArray(this.queryables)) {
        return [];
      }
      const collator = new Intl.Collator(this.uiLanguage);
      return this.queryables.slice(0).sort((a, b) => collator.compare(a.title, b.title));
    },
    // Filter queryables by search term (fuzzy-ish substring matching)
    filteredQueryables() {
      if (!this.queryableSearchTerm) {
        return this.sortedQueryables;
      }
      const term = this.queryableSearchTerm.toLowerCase();
      return this.sortedQueryables.filter(q => {
        // Match against title, id, or any part of the property name
        return (
          q.title.toLowerCase().includes(term) ||
          q.id.toLowerCase().includes(term)
        );
      });
    },
    // Check if we have namelist groups to display
    hasNamelistGroups() {
      return this.filteredQueryables.some(q => q.id.startsWith('nml:'));
    },
    // Group namelist parameters by their group name (e.g., nml:runctl:*, nml:radctl:*)
    queryableGroups() {
      const groups = {};
      const collator = new Intl.Collator(this.uiLanguage);

      this.filteredQueryables.forEach(q => {
        if (!q.supported) return;

        // Parse namelist properties: nml:{group}:{param} or nml:{file}:{group}:{param}
        if (q.id.startsWith('nml:')) {
          const parts = q.id.split(':');
          let groupName, shortId;

          if (parts.length >= 3) {
            // nml:radctl:co2vmr -> group=radctl, shortId=co2vmr
            // nml:namelist.echam:radctl:co2vmr -> group=namelist.echam:radctl, shortId=co2vmr
            groupName = parts.slice(1, -1).join(':');
            shortId = parts[parts.length - 1];
          } else {
            // nml:groups or similar
            groupName = 'general';
            shortId = parts.slice(1).join(':');
          }

          if (!groups[groupName]) {
            groups[groupName] = {
              name: groupName,
              title: this.formatGroupTitle(groupName),
              queryables: []
            };
          }
          // Add shortId for cleaner display in dropdown.
          // Use Object.create(proto) to preserve the Queryable prototype chain so that
          // methods like getOperators() remain callable when the chip is clicked.
          const qWithShortId = Object.assign(Object.create(Object.getPrototypeOf(q)), q, { shortId });
          groups[groupName].queryables.push(qWithShortId);
        }
      });

      // Sort queryables within each group
      Object.values(groups).forEach(group => {
        group.queryables.sort((a, b) => collator.compare(a.title, b.title));
      });

      // Return sorted groups
      return Object.values(groups).sort((a, b) => collator.compare(a.title, b.title));
    },
    // Queryables that are NOT in a group (non-namelist properties)
    filteredUngroupedQueryables() {
      return this.filteredQueryables.filter(q => {
        if (!q.supported) return false;
        // Exclude namelist properties (they're shown in groups)
        if (q.id.startsWith('nml:') && this.hasNamelistGroups) return false;
        return true;
      });
    },
    // Check if filtered results are empty
    filteredQueryablesEmpty() {
      if (!this.queryableSearchTerm) return false;
      return this.filteredUngroupedQueryables.length === 0 &&
             this.queryableGroups.every(g => g.queryables.length === 0);
    },
    // Quick filters visibility (show when we have queryables or collections)
    showQuickFilters() {
      return this.type === 'Collections' || (this.cql && this.queryables && this.queryables.length > 0);
    },
    // Available model components for quick filter
    availableComponents() {
      // Common ESM model components
      return [
        { text: 'ECHAM', value: 'echam' },
        { text: 'FESOM', value: 'fesom' },
        { text: 'JSBACH', value: 'jsbach' },
        { text: 'HDMODEL', value: 'hdmodel' },
        { text: 'OASIS', value: 'oasis' },
        { text: 'RECOM', value: 'recom' }
      ];
    },
    // Experiment type options
    experimentTypeOptions() {
      return [
        { value: 'control', text: 'Control' },
        { value: 'historical', text: 'Historical' },
        { value: 'scenario', text: 'Scenario' },
        { value: 'paleo', text: 'Paleo' },
        { value: 'sensitivity', text: 'Sensitivity' },
        { value: 'spinup', text: 'Spin-up' }
      ];
    },
    // Output frequency options
    frequencyOptions() {
      return [
        { value: 'mon', text: 'Monthly' },
        { value: 'day', text: 'Daily' },
        { value: '6hr', text: '6-hourly' },
        { value: '3hr', text: '3-hourly' },
        { value: '1hr', text: 'Hourly' },
        { value: 'subhr', text: 'Sub-hourly' }
      ];
    },
    maxItems() {
      return this.maxEntriesPerPage || 1000;
    },
    limitPlaceholder() {
      if (this.searchResultsPerPage > 0) {
        return this.$t('defaultWithValue', {value: this.searchResultsPerPage});
      }
      return this.$t('default');
    },
    datetime: {
      get() {
        return Array.isArray(this.query.datetime) ? this.query.datetime.map(d => Utils.dateFromUTC(d)) : null;
      },
      set(val) {
        this.query.datetime = Array.isArray(val) ? val.map(d => Utils.dateToUTC(d)) : null;
      }
    }
  },
  watch: {
    parent: {
      immediate: true,
      handler(newStac, oldStac) {
        if (newStac instanceof Collection) {
          newStac.setApiDataListener('searchfilter' + formId, () => this.updateApiCollections());
        }
        if (oldStac instanceof Collection) {
          oldStac.setApiDataListener('searchfilter' + formId);
        }
        this.updateApiCollections();
      }
    },
    value: {
      immediate: true,
      deep: true,
      handler(value) {
        this.query = Object.assign(getQueryDefaults(), value);
        if (this.collections.length > 0 && this.hasAllCollections) {
          this.selectedCollections = this.collections.filter(c => this.query.collections.includes(c.value));
        }
        else {
          this.selectedCollections = this.query.collections.map(id => {
            let collection = this.selectedCollections.find(c => c.value === id);
            return collection ? collection : this.collectionToMultiSelect({id});
          });
        }
      }
    },
    query: {
      deep: true,
      handler(query) {
        if (query?.bbox) {
          // Store the previously selected bbox so that it can be restored after the
          // map had been hidden accidentally.
          this.bbox = query.bbox;
        }
      }
    },
    selectedCollections: {
      deep: 1,
      handler(collections) {
        this.query.collections = collections.map(c => c.value);
      }
    },
    provideBBox(shown) {
      if (!shown) {
        this.query.bbox = null;
      }
      else {
        this.query.bbox = this.bbox;
      }
    }
  },
  beforeCreate() {
    formId++;
  },
  created() {
    let promises = [];
    if (this.cql && this.stac && this.type !== 'Collections') {
      const queryableLink = this.stac.getQueryablesLink();
      promises.push(
        this.loadQueryables(queryableLink)
          .catch(error => console.error(error))
      );
    }
    if ((this.type === 'Collections' || this.conformances.CollectionIdFilter) && this.stac) {
      promises.push(
        this.loadCollections(this.stac.getApiCollectionsLink())
          .then(({collections, queryableLink}) => {
            this.collections = collections;
            if (this.collections.length > 0) {
              this.hasAllCollections = true;
            }
            return this.loadQueryables(queryableLink);
          })
          .catch(error => console.error(error))
      );
    }
    // Load paleo presets for quick filters
    promises.push(
      this.loadPaleoPresets()
        .catch(error => console.warn('Failed to load paleo presets:', error))
    );
    Promise.all(promises).finally(() => this.loaded = true);
  },
  methods: {
    resetSearchCollection() {
      clearTimeout(this.collectionsLoadingTimer);
      this.collectionsLoadingTimer = null;
    },
    searchCollections(text) {
      if (!this.canSearchCollectionsFreeText || this.hasAllCollections) {
        return;
      }
      this.resetSearchCollection();
      this.additionalCollectionCount = 0;
      if (typeof text !== 'string' || text.trim().length < 2) {
        this.collections = [];
        return;
      }
      this.collectionsLoadingTimer = setTimeout(async () => {
        try {
          const link = Utils.addFiltersToLink(this.collectionSearchLink, {q: [text]});
          const response = await stacRequest(this.$store, link);
          
          // Only set collections if response is valid AND collectionsLoadingTimer has not been reset.
          // If collectionsLoadingTimer has been reset, the result is not relevant anylonger.
          if (this.collectionsLoadingTimer && CollectionCollection.isResponse(response.data)) {
            const stac = createSTAC(response.data);
            this.collections = this.prepareCollections(stac.getAll());
            if (typeof stac.numberMatched === 'number') {
              this.additionalCollectionCount = stac.numberMatched - this.collections.length;
            }
          }
        } catch (error) {
          console.error(error);
          this.collections = [];
        } finally {
          this.resetSearchCollection();
        }
      }, 250);
    },
    async loadCollections(link) {
      const data = {
        collections: [],
        queryableLink: null
      };

      if (this.type === 'Global' && this.collections) {
        data.collections = this.collections;
      }
      else if (this.type === 'Global' || this.type === 'Collections') {
        let response = await stacRequest(this.$store, link);
        
        if (!isObject(response.data)) {
          return {};
        }

        const stac = createSTAC(response.data);
        if (stac.getQueryablesLink) {
          data.queryableLink = stac.getQueryablesLink();
        }

        const paginationLinks = stac.getPaginationLinks();
        if (!paginationLinks.next && stac instanceof CollectionCollection) {
          data.collections = this.prepareCollections(stac.getAll());
        }
      }
      return data;
    },
    updateApiCollections() {
      if (!this.parent) {
        return;
      }
      let apiCollections = this.parent.getChildren('collections');
      let nextCollectionsLink = this.parent._apiChildren.next;
      if (!Array.isArray(apiCollections) || nextCollectionsLink || !this.conformances.CollectionIdFilter) {
        this.collections = [];
        return;
      }
      this.collections = this.prepareCollections(apiCollections);
      if (this.collections.length > 0) {
        this.hasAllCollections = true;
      }
    },
    collectionToMultiSelect(c) {
      return {
        value: c.id,
        text: c.title || c.id
      };
    },
    prepareCollections(collections) {
      const collator = new Intl.Collator(this.uiLanguage);
      return collections
        .map(this.collectionToMultiSelect)
        .sort((a,b) => collator.compare(a.text, b.text));
    },
    async loadQueryables(link) {
      this.queryables = [];

      if (!isObject(link)) {
        return;
      }

      let response = await stacRequest(this.$store, link);
      if (!isObject(response.data)) {
        return;
      }

      let schemas;
      try {
        schemas = await refParser.dereference(response.data);
      } catch (error) {
        // Use data with $refs included as fallback anyway
        console.error(error);
        schemas = response.data;
      }

      if (isObject(schemas) && isObject(schemas.properties)) {
        this.queryables = Object.entries(schemas.properties)
          .map(([key, schema]) => new Queryable(key, schema));
      }
    },
    buildFilter() {
      if (this.filters.length === 0) {
        return null;
      }
      const args = this.filters.map(f => {
        let filter = new f.operator(f.queryable, f.value);
        if (f.negate) {
          filter = new CqlNot(filter);
        }
        return filter;
      });
      let logical = CqlLogicalOperator.create(this.filtersAndOr, args);
      if (this.filtersNegate) {
        logical = new CqlNot(logical);
      }
      return new Cql(logical);
    },
    removeQueryable(queryableIndex) {
      this.filters.splice(queryableIndex, 1);
    },
    additionalFieldSelected(queryable) {
      const operators = queryable.getOperators(this.cql);
      if (operators.length === 0) {
        this.$store.commit('showGlobalError', {
          message: this.$t('search.noOperatorsError', {queryable: queryable.id})
        });
        return;
      }
      const operator = operators[0];
      this.filters.push({
        id: `${queryable.id}-${Date.now()}-${Math.random()}`, // Unique ID
        value: operator.getDefaultValue(queryable),
        operator,
        queryable,
        negate: false
      });
    },
    onSubmit() {
      if (this.canSort && this.sortTerm && this.sortOrder) {
        this.query.sortby = this.formatSort();
      }
      let filters = this.buildFilter();

      // Get quick filters and convert to CQL format
      const quickFilters = this.buildQuickFilters();
      if (quickFilters.length > 0) {
        const quickCqlArgs = quickFilters.map(qf => {
          // Create a queryable-like object with required methods
          const queryable = new Queryable(qf.field, { type: 'number' });

          if (qf.op === '>=') {
            return new CqlGreaterThanEqual(queryable, CqlValue.create(qf.value));
          } else if (qf.op === '<=') {
            return new CqlLessThanEqual(queryable, CqlValue.create(qf.value));
          } else if (qf.op === 'like') {
            return new CqlLike(queryable, CqlValue.create(qf.value));
          } else if (qf.op === 'in' && qf.values) {
            return new CqlIn(queryable, CqlValue.create(qf.values));
          }
          return null;
        }).filter(f => f !== null);

        if (quickCqlArgs.length > 0) {
          const quickCql = new CqlAnd(quickCqlArgs);
          if (filters) {
            // Combine manual filters with quick filters using AND
            filters = new Cql(new CqlAnd([filters.filter, quickCql]));
          } else {
            filters = new Cql(quickCql);
          }
        }
      }

      this.query.filters = filters;
      this.$emit('input', this.query, false);
    },
    async onReset() {
      Object.assign(this, getDefaults());
      this.$emit('input', {}, true);
    },
    setLimit(limit) {
      limit = Number.parseInt(limit, 10);
      if (limit > this.maxItems) {
        limit = this.maxItems;
      }
      else if (typeof limit !== 'number' || isNaN(limit) || limit < 1) {
        limit = null;
      }
      this.query.limit = limit;
    },
    addSearchTerm(term) {
      if (!hasText(term)) {
        return;
      }
      this.query.q.push(term);
    },
    addCollection(collection) {
      if (!this.collectionSelectOptions.taggable) {
        return;
      }
      this.resetSearchCollection();
      let opt = this.collectionToMultiSelect({id: collection});
      this.selectedCollections.push(opt);
      this.collections.push(opt);
      this.query.collections.push(collection);
    },
    addId(id) {
      this.query.ids.push(id);
    },
    formatSort() {
      if (this.sortTerm && this.sortTerm.value && this.sortOrder) {
        let order = this.sortOrder < 0 ? '-' : '';
        return `${order}${this.sortTerm.value}`;
      }
      else {
        return null;
      }
    },
    // Toggle a queryable group's expanded state
    toggleQueryableGroup(groupName) {
      this.expandedQueryableGroups[groupName] = !this.expandedQueryableGroups[groupName];
    },
    // Format a group name into a human-readable title
    formatGroupTitle(groupName) {
      // Handle namelist file:group format like "namelist.echam:radctl"
      if (groupName.includes(':')) {
        const parts = groupName.split(':');
        const file = parts[0].replace('namelist.', '');
        const group = parts.slice(1).join(':');
        return `${file.toUpperCase()} / ${group}`;
      }
      // Simple group name like "radctl"
      return groupName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    // Load paleo presets from API
    async loadPaleoPresets() {
      const fallbackPresets = [
        { id: 'lgm', name: 'LGM', display: '21.0 ka', years_bp: 21000, description: 'Last Glacial Maximum' },
        { id: 'mid_holocene', name: 'Mid-Holocene', display: '6.0 ka', years_bp: 6000, description: 'Mid-Holocene warm period' },
        { id: 'eemian', name: 'Eemian', display: '125.0 ka', years_bp: 125000, description: 'Last Interglacial' },
        { id: 'preindustrial', name: 'PI', display: '1850 CE', years_bp: 100, description: 'Pre-industrial' }
      ];
      try {
        const apiUrl = this.stac?.getAbsoluteUrl?.() || '';
        const baseUrl = apiUrl ? new URL(apiUrl).origin : '';
        if (!baseUrl) {
          this.paleoPresets = fallbackPresets;
          return;
        }

        const response = await fetch(`${baseUrl}/paleo-presets`);
        if (response.ok) {
          const data = await response.json();
          this.paleoPresets = data.presets || fallbackPresets;
        } else {
          this.paleoPresets = fallbackPresets;
        }
      } catch (error) {
        console.warn('Could not load paleo presets:', error);
        this.paleoPresets = fallbackPresets;
      }
    },
    // Set CO2 preset values
    setCO2Preset(preset) {
      const presets = {
        'preindustrial': { min: 280, max: 290 },
        '2xco2': { min: 550, max: 570 },
        '4xco2': { min: 1100, max: 1140 }
      };
      const p = presets[preset];
      if (p) {
        this.co2Min = p.min;
        this.co2Max = p.max;
      }
    },
    // Select a paleo time preset
    selectPaleoPreset(preset) {
      this.selectedPaleoPreset = preset.id;
      // Add filter for paleo time if we have the queryable
      // This will be included in the buildFilter when submitting
    },
    // Clear paleo preset selection
    clearPaleoPreset() {
      this.selectedPaleoPreset = null;
    },
    // Build quick filters into CQL2 format
    buildQuickFilters() {
      const quickFilters = [];

      // Model component filter (IN clause)
      if (this.selectedComponents.length > 0) {
        quickFilters.push({
          field: 'model',
          op: 'in',
          values: this.selectedComponents
        });
      }

      // CO2 range filter (converted from ppm to decimal)
      if (this.co2Min !== null || this.co2Max !== null) {
        // Look for CO2 VMR queryable
        const co2Field = 'nml:radctl:co2vmr';
        if (this.co2Min !== null) {
          // Convert ppm to decimal (volume mixing ratio)
          const minDecimal = this.co2Min * 1e-6;
          quickFilters.push({
            field: co2Field,
            op: '>=',
            value: minDecimal
          });
        }
        if (this.co2Max !== null) {
          const maxDecimal = this.co2Max * 1e-6;
          quickFilters.push({
            field: co2Field,
            op: '<=',
            value: maxDecimal
          });
        }
      }

      // CH4 range filter (converted from ppb to decimal)
      if (this.ch4Min !== null || this.ch4Max !== null) {
        const ch4Field = 'nml:radctl:ch4vmr';
        if (this.ch4Min !== null) {
          // Convert ppb to decimal (volume mixing ratio)
          const minDecimal = this.ch4Min * 1e-9;
          quickFilters.push({
            field: ch4Field,
            op: '>=',
            value: minDecimal
          });
        }
        if (this.ch4Max !== null) {
          const maxDecimal = this.ch4Max * 1e-9;
          quickFilters.push({
            field: ch4Field,
            op: '<=',
            value: maxDecimal
          });
        }
      }

      // N2O range filter (converted from ppb to decimal)
      if (this.n2oMin !== null || this.n2oMax !== null) {
        const n2oField = 'nml:radctl:n2ovmr';
        if (this.n2oMin !== null) {
          // Convert ppb to decimal (volume mixing ratio)
          const minDecimal = this.n2oMin * 1e-9;
          quickFilters.push({
            field: n2oField,
            op: '>=',
            value: minDecimal
          });
        }
        if (this.n2oMax !== null) {
          const maxDecimal = this.n2oMax * 1e-9;
          quickFilters.push({
            field: n2oField,
            op: '<=',
            value: maxDecimal
          });
        }
      }

      // Output frequency filter
      if (this.selectedFrequencies.length > 0) {
        quickFilters.push({
          field: 'output_frequency',
          op: 'in',
          values: this.selectedFrequencies
        });
      }

      // Experiment type filter
      if (this.selectedExperimentTypes.length > 0) {
        quickFilters.push({
          field: 'experiment_type',
          op: 'in',
          values: this.selectedExperimentTypes
        });
      }

      // Paleo time filter (years before present)
      if (this.selectedPaleoPreset) {
        const preset = this.paleoPresets.find(p => p.id === this.selectedPaleoPreset);
        if (preset && preset.years_bp !== undefined) {
          // Filter by paleo time - allow some range around the target year
          const tolerance = preset.years_bp * 0.1; // 10% tolerance
          quickFilters.push({
            field: 'paleo:years_bp',
            op: '>=',
            value: preset.years_bp - tolerance
          });
          quickFilters.push({
            field: 'paleo:years_bp',
            op: '<=',
            value: preset.years_bp + tolerance
          });
        }
      }

      return quickFilters;
    }
  }
});
</script>

<style lang="scss">
@import '../theme/datepicker.scss';

// Quick filters section styling
.quick-filters {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 0.25rem;
  margin-bottom: 1rem;

  .quick-filter-row {
    label {
      display: block;
      margin-bottom: 0.25rem;
      color: #495057;
    }
  }

  .quick-presets {
    display: flex;
    gap: 0.25rem;
  }
}

.queryables .dropdown-menu {
  max-height: 90vh;
  overflow: auto;
}

.queryables-menu {
  min-width: 300px;
}

.queryables-search {
  position: sticky;
  top: 0;
  z-index: 10;
}

.queryable-group {
  border-bottom: 1px solid #eee;

  .queryable-group-header {
    cursor: pointer;
    user-select: none;
    font-size: 0.9em;

    &:hover {
      background-color: #e9ecef !important;
    }

    .group-toggle {
      font-family: monospace;
      font-weight: bold;
      color: #6c757d;
    }
  }
}

.cursor-pointer {
  cursor: pointer;
}

// General item filter style
.filter {
  position: relative;
  min-width: 400px;

  .b-form-group {
    padding-left: 1em;
    margin-bottom: 1em;

    > label,
    > legend {
      margin-left: -1em;
      font-weight: 600;
    }

    > small {
      display: block;
    }
  }
}
</style>
