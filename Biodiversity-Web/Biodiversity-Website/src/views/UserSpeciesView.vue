<script setup>
import { computed, ref } from 'vue'
import { species } from '../services/speciesService'
import { statuses } from '../data/mockSpecies'
import StatusBadge from '../components/StatusBadge.vue'

// Filtering form element state variables
const search = ref('')
const status = ref('')
const family = ref('')

// Compute available taxonomic groups dynamically from live database rows
const families = computed(() => {
  if (!species.value) return []
  // 🟩 DATABASE COLUMN KEY CHANGED: Pulling from .family properties
  return [...new Set(species.value.map(r => r.family).filter(Boolean))].sort()
})

// Combined multi-criteria filter mechanism for search query, status select, and family select
const filtered = computed(() => {
  if (!species.value) return []
  const query = search.value.trim().toLowerCase()
  
  return species.value.filter(r => {
    // 🟩 DATABASE COLUMN KEYS CHANGED: Remapped matching properties to match the schema columns
    const matchesSearch = !query || 
      `${r.common_name} ${r.scientific_name}`.toLowerCase().includes(query)
    const matchesStatus = !status.value || r.status === status.value
    const matchesFamily = !family.value || r.family === family.value
    
    return matchesSearch && matchesStatus && matchesFamily
  })
})

// Clean handler function to wipe all filtering flags simultaneously
function clearFilters() {
  search.value = ''
  status.value = ''
  family.value = ''
}
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">PLANT KNOWLEDGE COLLECTION</p>
      <h1>Species database</h1>
      <p>View all documented national park species records.</p>
    </div>
  </div>

  <section class="panel">
    <!-- Filter Control Interface -->
    <div class="filters">
      <label class="search">
        Search species
        <input 
          v-model="search" 
          type="search" 
          placeholder="Scientific or common name"
        >
      </label>

      <label>
        Conservation status
        <select v-model="status">
          <option value="">All statuses</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>

      <label>
        Family
        <select v-model="family">
          <option value="">All families</option>
          <option v-for="f in families" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>

      <button class="button subtle" @click="clearFilters">Clear filters</button>
    </div>

    <!-- Data Summary Counter -->
    <div class="result-count" role="status">
      {{ filtered.length }} of {{ species?.length || 0 }} species found
    </div>

    <!-- Tabular Data Representation (Read-Only Layout) -->
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Species Detail</th>
            <th>Taxonomy</th>
            <th>Conservation Status</th>
            <th>Habitat & Environment</th>
            <th>Description & Heritage Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filtered" :key="record.species_id">
            <!-- 🟩 PHOTO COLUMN: Renders base64 string from data -->
            <td class="photo-cell">
              <img 
                v-if="record.photo" 
                :src="record.photo" 
                :alt="record.photo_name || record.common_name" 
                class="table-thumbnail" 
              />
              <span v-else class="no-photo">No image</span>
            </td>

            <td>
              <RouterLink class="table-name" :to="`/species/${record.species_id}`">
                {{ record.common_name }}
              </RouterLink>
              <i class="scientific">{{ record.scientific_name }}</i>
            </td>

            <td>
              <div class="taxonomy-info">
                <strong>Family:</strong> {{ record.family }}<br />
                <strong>Genus:</strong> {{ record.genus || 'N/A' }}
              </div>
            </td>

            <td>
              <StatusBadge :status="record.status" />
            </td>

            <!-- 🟩 HABITAT COLUMN -->
            <td class="habitat-cell">{{ record.habitat || 'Not specified' }}</td>

            <!-- 🟩 DESCRIPTION, ECOLOGICAL INFO, & CULTURAL SIGNIFICANCE COLUMNS -->
            <td class="info-cell">
              <div class="collapsible-notes">
                <p class="desc-text"><strong>Overview:</strong> {{ record.description }}</p>
                <p v-if="record.ecological_info" class="meta-text">
                  <span>🌱</span> <strong>Ecological:</strong> {{ record.ecological_info }}
                </p>
                <p v-if="record.cultural_sign" class="meta-text">
                  <span>🏛️</span> <strong>Cultural Sign:</strong> {{ record.cultural_sign }}
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Fallback Empty State Intercept Grid -->
    <div v-if="!filtered.length" class="empty">
      <h2>{{ species?.length ? 'No matching species' : 'The collection is empty' }}</h2>
      <p>
        {{ species?.length ? 'Try another search term or clear active filters.' : 'System records are currently unavailable.' }}
      </p>
    </div>
  </section>
</template>