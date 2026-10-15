<script setup>
import { computed, onMounted } from 'vue'
import { request } from '../services/authService'
import { species } from '../services/speciesService'
import { currentUser } from '../services/authService'
import StatusBadge from '../components/StatusBadge.vue'

onMounted(async () => {
  try {
    const data = await request('/api/get_species.php')
    species.value = data
  } catch (err) {
    console.error('Failed to sync overview metrics:', err)
  }
})

const isReadOnlyUser = computed(() => currentUser.value?.role === 'user' || currentUser.value?.role === 'botanist')
const threatened = computed(() => {
  if (!species.value) return 0
  return species.value.filter(r => ['Vulnerable', 'Endangered', 'Critically Endangered'].includes(r.status)).length
})
const families = computed(() => {
  if (!species.value) return 0
  return new Set(species.value.map(r => r.family).filter(Boolean)).size
})
const recent = computed(() => {
  if (!species.value) return []
  return [...species.value]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 5)
})
const distribution = computed(() => {
  if (!species.value || species.value.length === 0) return []
  const statuses = [...new Set(species.value.map(r => r.status).filter(Boolean))]
  return statuses.map(status => ({
    status,
    count: species.value.filter(r => r.status === status).length
  }))
})
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">YOUR CONSERVATION WORKSPACE</p>
      <h1>Overview</h1>
      <p>A clearer picture of your species collection.</p>
    </div>
    <RouterLink v-if="!isReadOnlyUser" class="button primary" to="/species/new">+ Add species</RouterLink>
  </div>

  <section class="stats" aria-label="Species summary">
    <article>
      <span>Total species</span>
      <strong>{{ species?.length || 0 }}</strong>
      <small>Records in this workspace</small>
    </article>
    <article>
      <span>Threatened species</span>
      <strong>{{ threatened }}</strong>
      <small>Vulnerable, endangered or critically endangered</small>
    </article>
    <article>
      <span>Plant families</span>
      <strong>{{ families }}</strong>
      <small>Represented in the collection</small>
    </article>
  </section>

  <div class="dashboard-grid">
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Recently updated</h2>
          <p>Your latest species records</p>
        </div>
        <RouterLink :to="isReadOnlyUser ? '/species-dashboard' : '/species'">View all</RouterLink>
      </div>
      
      <div v-if="!recent.length" class="empty">No species yet. Add your first record to get started.</div>
      
      <RouterLink 
        v-for="record in recent" 
        :key="record.species_id" 
        class="recent-row" 
        :to="isReadOnlyUser ? `/species-dashboard/${record.species_id}` : `/species/${record.species_id}`"
      >
        <span class="plant-initial">
          {{ record.genus?.slice(0, 1) || record.scientific_name?.[0] || 'P' }}
        </span>
        <span class="record-name">
          <strong>{{ record.common_name }}</strong>
          <i>{{ record.scientific_name }}</i>
        </span>
        <StatusBadge :status="record.status" />
      </RouterLink>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Conservation status</h2>
          <p>Distribution of species records</p>
        </div>
      </div>
      <div class="distribution">
        <div v-for="group in distribution" :key="group.status" class="bar-group">
          <div>
            <span>{{ group.status }}</span>
            <strong>{{ group.count }}</strong>
          </div>
          <div class="bar-track">
            <span :style="{ width: species?.length ? `${(group.count / species.length) * 100}%` : '0%' }"></span>
          </div>
        </div>
        <p v-if="!distribution.length">No records to summarize.</p>
      </div>
      <div class="panel-note">Verified live assessments generated from systems core database.</div>
    </section>
  </div>

  <section class="collection-banner">
    <div>
      <p class="eyebrow">BUILD THE KNOWLEDGE COLLECTION</p>
      <h2>Every record starts with good information.</h2>
      <p>Document taxonomy, conservation status and the stories behind each species.</p>
    </div>
    <RouterLink class="button" :to="isReadOnlyUser ? '/species-dashboard' : '/species'">
      {{ isReadOnlyUser ? 'Browse species' : 'Manage species' }}
    </RouterLink>
  </section>
</template>
