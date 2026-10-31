<script setup>
import { computed, onBeforeUnmount, onMounted, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { request, refreshSession } from '../services/authService'
import { statuses } from '../data/mockSpecies'
import { filterRecords, summarize, reportCsv } from '../services/reportService'
import '../reports.css'

const router = useRouter()
const records = ref([]), loading = ref(false), error = ref(''), notice = ref(''), report = ref(null), exporting = ref(false)
const filters = reactive({ search: '', family: '', status: '' })
const families = computed(() => [...new Set(records.value.map(record => record.family).filter(Boolean))].sort())
const allStatuses = computed(() => [...new Set([...statuses, ...records.value.map(record => record.status).filter(Boolean)])])
const matching = computed(() => filterRecords(records.value, filters))
const changed = computed(() => report.value && JSON.stringify(filters) !== JSON.stringify(report.value.filters))
let mounted = true

function deny(status) {
  records.value = []; report.value = null
  router.replace(status === 401 ? { path: '/login', query: { redirect: '/reports', reason: 'expired' } } : '/access-denied')
}
async function verifyAccess() {
  const user = await refreshSession()
  if (!mounted) return false
  if (!user) { deny(401); return false }
  if (!['admin', 'conservation_officer'].includes(user.role)) { deny(403); return false }
  return true
}
async function load() {
  if (loading.value || exporting.value) return
  loading.value = true; error.value = ''; notice.value = ''; report.value = null; records.value = []
  try {
    const data = await request('/api/get_biodiversity_report.php')
    if (!Array.isArray(data) || data.some(record => !record || typeof record !== 'object' || Array.isArray(record))) throw new Error('Invalid species list returned by the server.')
    if (mounted) records.value = data
  } catch (e) {
    if (!mounted) return
    if ([401, 403].includes(e.status)) deny(e.status)
    else error.value = e.message || 'Unable to load species.'
  } finally { if (mounted) loading.value = false }
}
async function generate() {
  if (loading.value || exporting.value || error.value || !matching.value.length) return
  exporting.value = true; notice.value = ''
  try {
    if (!await verifyAccess()) return
    const selected = matching.value.map(record => ({ ...record }))
    report.value = { generatedAt: new Date().toISOString(), filters: { ...filters }, records: selected, summary: summarize(selected) }
    notice.value = `Report generated with ${selected.length} species records.`
  } catch (e) { if (mounted) notice.value = e.message || 'Unable to verify your session before generation.' }
  finally { if (mounted) exporting.value = false }
}
async function exportReport(format) {
  if (!report.value || changed.value || loading.value || exporting.value) return
  exporting.value = true; notice.value = ''
  const snapshot = report.value
  try {
    if (!await verifyAccess() || changed.value || snapshot !== report.value) return
    if (format === 'print') { window.print(); return }
    const url = URL.createObjectURL(new Blob([reportCsv(snapshot)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'niah-biodiversity-' + snapshot.generatedAt.replaceAll(':', '-') + '.csv'
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = 'CSV download requested. Check your browser downloads.'
  } catch (e) { if (mounted) notice.value = e.message || 'Export failed.' }
  finally { if (mounted) exporting.value = false }
}
onMounted(load)
onBeforeUnmount(() => { mounted = false })
</script>

<template>
<div class="reports-page">
 <div class="page-heading report-controls"><div><p class="eyebrow">CONSERVATION WORKSPACE</p><h1>Biodiversity reports</h1><p>Generate a species inventory summary from the shared database.</p></div><button class="button" :disabled="loading||exporting" @click="load">Refresh data</button></div>
 <section class="panel report-builder report-controls"><h2>Choose records</h2><p>Filters apply to the current species inventory, not observations, abundance or historical change.</p><form @submit.prevent="generate">
 <div class="report-filters"><label>Scientific or common name<input v-model="filters.search" type="search" placeholder="All names" :disabled="loading||exporting"></label><label>Family<select v-model="filters.family" :disabled="loading||exporting"><option value="">All families</option><option v-for="family in families" :key="family">{{ family }}</option></select></label><label>Conservation status<select v-model="filters.status" :disabled="loading||exporting"><option value="">All statuses</option><option v-for="status in allStatuses" :key="status">{{ status }}</option></select></label></div>
 <div class="report-actions"><button type="button" class="button" :disabled="loading||exporting" @click="Object.assign(filters,{search:'',family:'',status:''})">Clear filters</button><button class="button primary" :disabled="loading||exporting||!!error||!matching.length">Generate report</button><span v-if="!loading&&!error">{{ matching.length }} matching records</span></div></form></section>
 <p v-if="loading" role="status" class="report-message report-controls">Loading species from the database…</p><p v-else-if="error" role="alert" class="error report-controls">{{ error }} Use Refresh data to retry.</p><p v-else-if="!matching.length" class="report-message report-controls">{{ records.length?'No records match these filters. Try clearing the filters.':'There are no species records to report yet.' }}</p>
 <p v-if="changed" role="status" class="report-message report-controls">Filters have changed. Generate the report again before exporting.</p><p v-if="notice" role="status" class="report-message report-controls">{{ notice }}</p>
 <template v-if="report"><div class="report-actions report-controls"><button class="button primary" :disabled="changed||exporting" @click="exportReport('csv')">Export CSV</button><button class="button" :disabled="changed||exporting" @click="exportReport('print')">Print / Save as PDF</button><span>Choose “Save as PDF” in the print dialog for a PDF file.</span></div>
 <article class="panel report-document" aria-label="Generated biodiversity report"><header><p class="eyebrow">NIAH NATIONAL PARK</p><h2>Biodiversity species inventory report</h2><p>Generated: {{ new Date(report.generatedAt).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'}) }} (Malaysia time)</p><p>Source: shared species database · {{ report.records.length }} records in this snapshot</p><p>Search: {{ report.filters.search||'All names' }} · Family: {{ report.filters.family||'All families' }} · Status: {{ report.filters.status||'All statuses' }}</p></header>
 <div class="report-totals"><div><strong>{{ report.summary.total }}</strong><span>Species records</span></div><div><strong>{{ report.summary.families }}</strong><span>Plant families</span></div><div><strong>{{ report.summary.threatened }}</strong><span>Threatened species records</span></div></div><p class="report-caption">Threatened includes Vulnerable, Endangered and Critically Endangered. Status values are database assessments, not independently verified by this report.</p>
 <h3>Conservation status summary</h3><table class="report-summary"><thead><tr><th scope="col">Status</th><th scope="col">Records</th></tr></thead><tbody><tr v-for="[status,count] in report.summary.statuses" :key="status"><td>{{ status }}</td><td>{{ count }}</td></tr></tbody></table>
 <h3>Species inventory</h3><div class="report-table-wrap"><table class="report-inventory"><thead><tr><th scope="col">ID</th><th scope="col">Common name</th><th scope="col">Scientific name</th><th scope="col">Family</th><th scope="col">Status</th><th scope="col">Habitat</th></tr></thead><tbody><tr v-for="(r,index) in report.records" :key="index"><td>{{ r.species_id }}</td><td>{{ r.common_name||'Not recorded' }}</td><td><i>{{ r.scientific_name||'Not recorded' }}</i></td><td>{{ r.family||'Not recorded' }}</td><td>{{ r.status||'Not recorded' }}</td><td>{{ r.habitat||'Not recorded' }}</td></tr></tbody></table></div><p class="report-caption">CSV also includes genus, descriptions, ecological information, cultural significance and source update timestamps. Counts refer to species records, not individual plants or population estimates.</p>
 </article></template><section v-else-if="!loading&&!error&&matching.length" class="panel empty report-controls"><h2>Your report preview will appear here</h2><p>Choose your filters, then select Generate report.</p></section>
</div>
</template>
