/**
 * Vuex module for collection comparison feature.
 *
 * Allows users to select 2-3 collections for side-by-side comparison
 * of their namelist parameters and other properties.
 */

const MAX_SELECTIONS = 3;

export default function() {
  return {
    namespaced: true,
    state: () => ({
      // Selected collection IDs for comparison
      selectedCollections: [],
      // Full collection data (fetched when comparison modal opens)
      collectionData: {},
      // Whether the comparison modal is open
      isModalOpen: false
    }),
    getters: {
      // Number of selected collections
      selectionCount: state => state.selectedCollections.length,
      // Check if a collection is selected
      isSelected: state => collectionId => state.selectedCollections.includes(collectionId),
      // Can we add more selections?
      canAddMore: state => state.selectedCollections.length < MAX_SELECTIONS,
      // Are we ready to compare? (need at least 2)
      canCompare: state => state.selectedCollections.length >= 2,
      // Get all namelist parameters across selected collections
      allParameters: state => {
        const params = new Set();
        for (const data of Object.values(state.collectionData)) {
          if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
              if (key.startsWith('nml:')) {
                params.add(key);
              }
            }
          }
        }
        return Array.from(params).sort();
      },
      // Get parameter value for a collection
      getParamValue: state => (collectionId, paramKey) => {
        const data = state.collectionData[collectionId];
        if (!data) return null;
        return data[paramKey] ?? data.properties?.[paramKey] ?? null;
      },
      // Check if a parameter has different values across collections
      hasDifference: (state, getters) => paramKey => {
        const values = state.selectedCollections.map(id =>
          getters.getParamValue(id, paramKey)
        );
        const uniqueValues = new Set(values.map(v => JSON.stringify(v)));
        return uniqueValues.size > 1;
      }
    },
    mutations: {
      // Toggle selection of a collection
      toggleSelection(state, collectionId) {
        const index = state.selectedCollections.indexOf(collectionId);
        if (index === -1) {
          // Add if not at max
          if (state.selectedCollections.length < MAX_SELECTIONS) {
            state.selectedCollections.push(collectionId);
          }
        } else {
          // Remove
          state.selectedCollections.splice(index, 1);
          // Also remove cached data
          delete state.collectionData[collectionId];
        }
      },
      // Clear all selections
      clearSelections(state) {
        state.selectedCollections = [];
        state.collectionData = {};
      },
      // Store fetched collection data
      setCollectionData(state, { collectionId, data }) {
        state.collectionData[collectionId] = data;
      },
      // Open/close comparison modal
      setModalOpen(state, isOpen) {
        state.isModalOpen = isOpen;
      }
    },
    actions: {
      // Toggle selection and trigger data fetch if needed
      toggleCollection({ commit, state }, collectionId) {
        commit('toggleSelection', collectionId);
      },
      // Open comparison modal and fetch any missing data
      async openComparison({ commit, state, dispatch }) {
        commit('setModalOpen', true);
        // Fetch data for any collections we don't have yet
        for (const id of state.selectedCollections) {
          if (!state.collectionData[id]) {
            await dispatch('fetchCollectionData', id);
          }
        }
      },
      // Close comparison modal
      closeComparison({ commit }) {
        commit('setModalOpen', false);
      },
      // Fetch full collection data for comparison
      async fetchCollectionData({ commit, rootState }, collectionId) {
        try {
          // Look up in the store's database
          const stacData = rootState.database[collectionId];
          if (stacData && typeof stacData === 'object' && !(stacData instanceof Error)) {
            commit('setCollectionData', { collectionId, data: stacData });
            return;
          }
          // If not in cache, we might need to fetch it
          // For now, just store what we have
          commit('setCollectionData', { collectionId, data: null });
        } catch (error) {
          console.warn('Failed to fetch collection data for comparison:', error);
          commit('setCollectionData', { collectionId, data: null });
        }
      }
    }
  };
}
