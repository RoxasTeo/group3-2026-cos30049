<script setup>
import { computed, ref, onMounted } from 'vue'
import { request } from '../services/authService'
import { statuses } from '../data/mockSpecies'
import StatusBadge from '../components/StatusBadge.vue'

const species = ref([])
const search = ref('')
const status = ref('')
const family = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await request('/api/get_user_species.php')
    species.value = data
  } catch (err) {
    error.value = err.message || 'Failed to load species data.'
  } finally {
    loading.value = false
  }
})

const families = computed(() => {
  if (!species.value) return []
  return [...new Set(species.value.map(r => r.family).filter(Boolean))].sort()
})

const filtered = computed(() => {
  if (!species.value) return []
  const query = search.value.trim().toLowerCase()
  
  return species.value.filter(r => {
    const matchesSearch = !query || `${r.common_name} ${r.scientific_name}`.toLowerCase().includes(query)
    const matchesStatus = !status.value || r.status === status.value
    const matchesFamily = !family.value || r.family === family.value
    
    return matchesSearch && matchesStatus && matchesFamily
  })
})

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
    <div v-if="loading" class="alert info">Loading species database records...</div>
    <div v-else-if="error" class="alert error">{{ error }}</div>
    
    <template v-else>
      <div class="filters">
        <label class="search">
          Search species
          <input v-model="search" type="search" placeholder="Scientific or common name">
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

      <div class="result-count" role="status">
        {{ filtered.length }} of {{ species.length }} species found
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Species Detail</th>
              <th>Taxonomy</th>
              <th>Conservation Status</th>
              <th>Habitat & Environment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filtered" :key="record.species_id">
              <td class="photo-cell">
                <img v-if="record.photo" :src="record.photo" :alt="record.photo_name || record.common_name" class="table-thumbnail" />
                <span v-else class="no-photo">No image</span>
              </td>
              <td>
                <RouterLink class="table-name" :to="`/species-dashboard/${record.species_id}`">
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
              <td><StatusBadge :status="record.status" /></td>
              <td>{{ record.habitat || 'Not specified' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!filtered.length" class="empty">
        <h2>No matching species found</h2>
        <p>Try another search term or clear active filters.</p>
      </div>
    </template>
  </section>
</template>
