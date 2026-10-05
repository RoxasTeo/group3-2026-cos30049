<script setup>
import { computed } from 'vue'
import { species } from '../services/speciesService'
import StatusBadge from '../components/StatusBadge.vue'
const threatened = computed(() => species.value.filter(r => ['Vulnerable','Endangered','Critically Endangered'].includes(r.status)).length)
const families = computed(() => new Set(species.value.map(r => r.family)).size)
const recent = computed(() => [...species.value].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,5))
const distribution = computed(() => [...new Set(species.value.map(r => r.status))].map(status => ({ status, count: species.value.filter(r => r.status === status).length })))
</script>
<template>
  <div class="page-heading"><div><p class="eyebrow">YOUR CONSERVATION WORKSPACE</p><h1>Overview</h1><p>A clearer picture of your species collection.</p></div><RouterLink class="button primary" to="/species/new">+ Add species</RouterLink></div>
  <section class="stats" aria-label="Species summary"><article><span>Total species</span><strong>{{ species.length }}</strong><small>Records in this workspace</small></article><article><span>Threatened species</span><strong>{{ threatened }}</strong><small>Vulnerable, endangered or critically endangered</small></article><article><span>Plant families</span><strong>{{ families }}</strong><small>Represented in the collection</small></article></section>
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Recently updated</h2><p>Your latest species records</p></div><RouterLink to="/species">View all</RouterLink></div><div v-if="!recent.length" class="empty">No species yet. Add your first record to get started.</div><RouterLink v-for="record in recent" :key="record.id" class="recent-row" :to="`/species/${record.id}`"><span class="plant-initial">{{ record.genus?.slice(0,1) || record.scientificName[0] }}</span><span class="record-name"><strong>{{ record.commonName }}</strong><i>{{ record.scientificName }}</i></span><StatusBadge :status="record.status" /></RouterLink></section>
  <section class="panel"><div class="panel-heading"><div><h2>Conservation status</h2><p>Distribution of species records</p></div></div><div class="distribution"><div v-for="group in distribution" :key="group.status" class="bar-group"><div><span>{{ group.status }}</span><strong>{{ group.count }}</strong></div><div class="bar-track"><span :style="{ width: `${group.count / species.length * 100}%` }"></span></div></div><p v-if="!distribution.length">No records to summarize.</p></div><div class="panel-note">Demo assessments are for interface testing only.</div></section></div>
  <section class="collection-banner"><div><p class="eyebrow">BUILD THE KNOWLEDGE COLLECTION</p><h2>Every record starts with good information.</h2><p>Document taxonomy, conservation status and the stories behind each species.</p></div><RouterLink class="button" to="/species">Manage species</RouterLink></section>
</template>
