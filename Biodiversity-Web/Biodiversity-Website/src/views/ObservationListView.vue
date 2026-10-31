<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listObservations, reviewDate, reviewStatuses } from '../services/observationService'
import '../observation-review.css'

const router = useRouter()
const status = ref('Pending'), search = ref(''), submitter = ref(''), page = ref(1)
const data = ref(null), loading = ref(true), error = ref('')
let generation = 0, timer, controller
const filters = computed(() => ({ status: status.value, q: search.value.trim(), submitter: submitter.value, page: page.value }))
async function load() {
  clearTimeout(timer)
  controller?.abort()
  controller = new AbortController()
  const token = ++generation
  loading.value = true; error.value = ''; data.value = null
  try {
    const result = await listObservations(filters.value, controller.signal)
    if (token === generation) data.value = result
  } catch (e) {
    if (token !== generation) return
    if (e.status === 401) router.replace({ path: '/login', query: { redirect: '/observations' } })
    else if (e.status === 403) router.replace('/access-denied')
    else error.value = e.message || 'Unable to retrieve observations.'
  } finally { if (token === generation) loading.value = false }
}
function schedule() {
  page.value = 1
  // Invalidate the visible queue immediately; stale responses cannot overwrite new filters.
  generation++; controller?.abort(); data.value = null; loading.value = true
  clearTimeout(timer); timer = setTimeout(load, 250)
}
watch([status, search, submitter], schedule)
function changePage(next) { page.value = next; load() }
function reset() { status.value = 'All'; search.value = ''; submitter.value = ''; page.value = 1 }
onMounted(load)
onBeforeUnmount(() => { generation++; controller?.abort(); clearTimeout(timer) })
</script>

<template>
  <div class="observation-page">
    <div class="page-heading"><div><p class="eyebrow">FIELD SUBMISSIONS / QUALITY REVIEW</p><h1>Observation review</h1><p>Check field evidence before accepting submitted plant observations.</p></div><button class="button" :disabled="loading" @click="load">{{ loading ? 'Loading…' : 'Refresh observations' }}</button></div>
    <div class="observation-tabs" role="group" aria-label="Submission status">
      <button v-for="item in reviewStatuses" :key="item" class="button" :class="{ primary: status === item }" :aria-pressed="status === item" @click="status = item">{{ item }}<span v-if="data"> · {{ data.counts[item] }}</span></button>
    </div>
    <form class="observation-filters" role="search" @submit.prevent="load">
      <label>Search observations<input v-model="search" type="search" maxlength="50" placeholder="Plant name, tag or observation ID"></label>
      <label>Submitted by<select v-model="submitter"><option value="">All botanists</option><template v-if="data"><option v-for="user in data.submitters" :key="user.id" :value="String(user.id)">{{ user.name }}</option></template><option v-else-if="submitter" :value="submitter">Selected botanist</option></select></label>
    </form>
    <p v-if="loading" role="status">Loading observations…</p>
    <section v-else-if="error" class="panel"><p class="error" role="alert">{{ error }}</p><button class="button" @click="load">Retry loading</button></section>
    <template v-else-if="data">
      <div v-if="!data.observations.length" class="panel empty"><h2>No matching observations</h2><p v-if="data.counts.All === 0 && !search && !submitter">No submissions have been received yet. Botanists must submit field observations before they appear here.</p><p v-else>Try another search or status.</p><button class="button" @click="reset">Clear filters</button></div>
      <div v-else class="table-scroll observation-table"><table><thead><tr><th>Observation / plant</th><th>Submitted by</th><th>Field evidence</th><th>Status</th><th>Action</th></tr></thead><tbody><tr v-for="record in data.observations" :key="record.id">
        <td><strong>{{ record.common_name }}</strong><small>{{ record.reference }} · {{ record.plant_tag }}</small></td>
        <td>{{ record.submitter_name }}<small>{{ reviewDate(record.submitted_at) }}</small></td>
        <td>{{ record.photo_count }} photograph(s)<small>{{ record.latitude == null ? 'GPS missing' : record.accuracy_m == null ? 'GPS · accuracy not supplied' : `GPS ±${record.accuracy_m} m` }}</small></td>
        <td><span class="observation-status" :data-status="record.status">{{ record.status }}</span></td>
        <td><RouterLink class="button" :to="`/observations/${record.id}`" :aria-label="`${record.status === 'Pending' ? 'Review' : 'View'} ${record.reference}`">{{ record.status === 'Pending' ? 'Review' : 'View' }}</RouterLink></td>
      </tr></tbody></table></div>
      <div class="observation-pagination"><span role="status">{{ data.total }} matching observation(s) · Page {{ data.page }} of {{ data.pages }}</span><div class="actions"><button class="button" :disabled="data.page <= 1" @click="changePage(data.page - 1)">Previous</button><button class="button" :disabled="data.page >= data.pages" @click="changePage(data.page + 1)">Next</button></div></div>
    </template>
    <p class="observation-hint">Approval accepts the observation. It does not automatically overwrite the species knowledge record.</p>
  </div>
</template>
