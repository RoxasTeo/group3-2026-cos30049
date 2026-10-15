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

// Fetch data from the shared backend script route
onMounted(async () => {
  try {
    const data = await request('/api/get_species.php')
    species.value = data
  } catch (err) {
    error.value = err.message || 'Failed to load species data.'
  } finally {
    loading.value = false
  }
})

// Dynamically extract unique families for the dropdown menu
const families = computed(() => {
  if (!species.value) return []
  return [...new Set(species.value.map(r => r.family).filter(Boolean))].sort()
})

// Filter data on the client-side based on user input flags
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
      <p class="eyebrow">CONSERVATION MANAGEMENT SYSTEM</p>
      <h1>Species management</h1>
      <p>Maintain, update, and audit verified park inventory sheets.</p>
    </div>
    <div class="actions">
      <RouterLink class="button primary" to="/species/new">+ Add new species</RouterLink>
    </div>
  </div>

  <section class="panel">
    <div v-if="loading" class="alert info">Loading workspace assets...</div>
    <div v-else-if="error" class="alert error">{{ error }}</div>
    
    <template v-else>
      <!-- Filters Panel -->
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
        {{ filtered.length }} of {{ species.length }} inventory entries
      </div>

      <!-- Tabular Grid Layout matching your explicit columns -->
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <!-- 🟩 YOUR EXPLICIT SPECIFIED HEADERS -->
              <th>Species</th>
              <th>Family</th>
              <th>Conservation status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filtered" :key="record.species_id">
              <!-- Column 1: Species Name and Scientific Notation -->
              <td>
                <RouterLink class="table-name" :to="`/species/${record.species_id}`">
                  {{ record.common_name }}
                </RouterLink>
                <i class="scientific">{{ record.scientific_name }}</i>
              </td>
              
              <!-- Column 2: Family -->
              <td>{{ record.family }}</td>
              
              <!-- Column 3: Conservation Status Badge Component -->
              <td>
                <StatusBadge :status="record.status" />
              </td>
              
              <!-- Column 4: Last Updated Time Stamp (Formatted locally to DD/MM/YYYY) -->
              <td>
                {{ record.updated_at ? new Date(record.updated_at).toLocaleDateString('en-GB') : 'N/A' }}
              </td>
              
              <!-- Column 5: Privileged CRUD Action Links -->
              <td>
                <div class="row-actions">
                  <RouterLink class="button subtle small" :to="`/species/${record.species_id}/edit`">Edit</RouterLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State Catch -->
      <div v-if="!filtered.length" class="empty">
        <h2>No records matching criteria found</h2>
        <p>Try another name or add a new entry to the database collection.</p>
      </div>
    </template>
  </section>
</template>