<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distributionColor, distributionStats, hasCoordinates, loadDistribution } from '../services/distributionService.js'
import { detailFromDistribution, initialDistribution, rememberDistribution } from '../services/distributionNavigation.js'
import { reviewDate } from '../services/observationService.js'
import niahContext from '../data/niah-context.json'
import '../species-distribution.css'

const route = useRoute(), router = useRouter()
const initial = initialDistribution(route.query)
const search = ref(initial.q), species = ref(initial.species), conservation = ref(initial.conservation), pending = ref(initial.pending)
const data = ref(null), speciesOptions = ref([]), statusOptions = ref([]), loading = ref(true), error = ref('')
const selectedId = ref(null), mapElement = ref(null), tileError = ref(false), online = ref(initial.online), listPage = ref(1)
const records = computed(() => data.value?.records || [])
const stats = computed(() => distributionStats(records.value))
const selected = computed(() => records.value.find(record => record.id === selectedId.value))
const listPages = computed(() => Math.max(1, Math.ceil(records.value.length / 20)))
const visibleRecords = computed(() => records.value.slice((listPage.value - 1) * 20, listPage.value * 20))
function navigationState() { return { q: search.value, species: species.value, conservation: conservation.value, pending: pending.value, selected: selectedId.value, online: online.value } }
function detailLink(path) { return detailFromDistribution(path, navigationState()) }
let map, markers, tileLayer, accuracyCircle, resizeObserver, mounted = true, requestId = 0, controller, timer
const markerById = new Map()
const niahView = [[3.77, 113.73], [3.85, 113.84]]

function fit() {
  if (!map) return
  if (stats.value.mapped.length) map.fitBounds(stats.value.mapped.map(record => [record.latitude, record.longitude]), { padding: [35, 35], maxZoom: 16, animate: false })
  else map.fitBounds(niahView, { animate: false })
}
function markerIcon(record, index) {
  const button = document.createElement('button')
  button.type = 'button'; button.className = 'distribution-marker'
  button.style.setProperty('--distribution-marker-color', distributionColor(record.conservation_status))
  button.dataset.pending = String(record.review_status === 'Pending')
  button.setAttribute('aria-label', `Select ${record.common_name}, ${record.reference}, ${record.review_status}`)
  button.setAttribute('aria-pressed', String(record.id === selectedId.value))
  const dot = document.createElement('span'); dot.textContent = String(index + 1); button.appendChild(dot)
  // Text content and attributes, never submitted HTML, enter the Leaflet marker.
  return L.divIcon({ html: button, className: 'distribution-marker-host', iconSize: [42, 42], iconAnchor: [21, 21] })
}
function updateSelection() {
  for (const [id, marker] of markerById) marker.getElement()?.querySelector('button')?.setAttribute('aria-pressed', String(id === selectedId.value))
  if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null }
  const record = selected.value
  if (map && record && hasCoordinates(record) && typeof record.accuracy_m === 'number' && record.accuracy_m >= 0 && record.accuracy_m <= 100000) {
    accuracyCircle = L.circle([record.latitude, record.longitude], { radius: record.accuracy_m, color: '#47664c', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map)
  }
}
function select(record, locate = false) {
  selectedId.value = record.id
  if (locate && map && hasCoordinates(record)) map.setView([record.latitude, record.longitude], Math.max(map.getZoom(), 15), { animate: false })
  updateSelection()
}
function drawMarkers() {
  if (!markers) return
  markers.clearLayers(); markerById.clear()
  stats.value.mapped.forEach((record, index) => {
    const marker = L.marker([record.latitude, record.longitude], { icon: markerIcon(record, index), keyboard: false })
    marker.addTo(markers)
    marker.getElement()?.querySelector('button')?.addEventListener('click', () => select(record))
    markerById.set(record.id, marker)
  })
  updateSelection(); fit()
}
function setupMap() {
  map = L.map(mapElement.value, { scrollWheelZoom: false, zoomControl: true, maxZoom: 19, minZoom: 2 })
  L.geoJSON(niahContext, { style: feature => ({ color: feature.properties.kind === 'water' ? '#8bafbd' : '#bcb6a1', weight: feature.properties.kind === 'water' ? 2 : 1, fillColor: '#d4e2c5', fillOpacity: 0.45 }), interactive: false, attribution: 'Local Niah context © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map)
  tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' })
  tileLayer.on('tileerror', () => { tileError.value = true })
  if (online.value) tileLayer.addTo(map)
  markers = L.layerGroup().addTo(map)
  L.control.scale({ imperial: false }).addTo(map)
  map.fitBounds(niahView)
  resizeObserver = new ResizeObserver(() => { map?.invalidateSize({ pan: false }); fit() })
  resizeObserver.observe(mapElement.value)
}
async function load() {
  clearTimeout(timer); controller?.abort(); controller = new AbortController()
  const id = ++requestId
  loading.value = true; error.value = ''; data.value = null; selectedId.value = null
  markers?.clearLayers(); markerById.clear(); updateSelection()
  try {
    const result = await loadDistribution({ q: search.value.trim(), species: species.value, conservation: conservation.value, pending: pending.value }, controller.signal)
    if (!mounted || id !== requestId) return
    data.value = result; speciesOptions.value = result.species; statusOptions.value = result.conservation_statuses
    selectedId.value = records.value.find(record => record.id === Number(initial.selected))?.id ?? stats.value.mapped[0]?.id ?? records.value[0]?.id ?? null
    listPage.value = 1; await nextTick(); drawMarkers()
  } catch (e) {
    if (!mounted || id !== requestId) return
    if (e.status === 401) router.replace({ path: '/login', query: { redirect: route.fullPath } })
    else if (e.status === 403) router.replace('/access-denied')
    else error.value = e.message || 'Unable to load observation locations.'
  } finally { if (mounted && id === requestId) loading.value = false }
}
function schedule() {
  requestId++; controller?.abort(); data.value = null; selectedId.value = null; loading.value = true
  markers?.clearLayers(); markerById.clear(); updateSelection()
  clearTimeout(timer); timer = setTimeout(load, 250)
}
watch([search, species, conservation, pending], schedule)
watch(online, enabled => {
  if (!map || !tileLayer) return
  if (enabled) { tileError.value = false; tileLayer.addTo(map); tileLayer.redraw() }
  else tileLayer.remove()
})
function reset() { search.value = ''; species.value = ''; conservation.value = ''; pending.value = false; load() }
onMounted(() => { setupMap(); load() })
onBeforeUnmount(() => { rememberDistribution(navigationState()); mounted = false; requestId++; controller?.abort(); clearTimeout(timer); resizeObserver?.disconnect(); map?.remove(); map = null })
</script>

<template>
  <div class="distribution-page">
    <div class="page-heading"><div><p class="eyebrow">PLANT KNOWLEDGE / LOCATION EVIDENCE</p><h1>Species distribution</h1><p>Explore where plant observations have been recorded.</p></div><button class="button primary" :disabled="loading" @click="load">{{ loading ? 'Loading…' : 'Refresh locations' }}</button></div>
    <form class="distribution-filters" role="search" @submit.prevent="load">
      <label>Search species or plant tag<input v-model="search" type="search" maxlength="50" placeholder="Common name, scientific name or tag"></label>
      <label>Species<select v-model="species"><option value="">All linked species</option><option v-if="species && !speciesOptions.some(item => String(item.species_id) === species)" :value="species">Species #{{ species }}</option><option v-for="item in speciesOptions" :key="item.species_id" :value="String(item.species_id)">{{ item.common_name }} · {{ item.scientific_name }}</option></select></label>
      <label>Conservation status<select v-model="conservation"><option value="">All statuses</option><option v-for="status in statusOptions" :key="status">{{ status }}</option></select></label>
    </form>
    <div class="distribution-options"><label><input v-model="pending" type="checkbox">Show pending observations</label><label><input v-model="online" type="checkbox">Online basemap</label><button class="button" @click="reset">Reset filters</button></div>
    <p v-if="error" class="error" role="alert">{{ error }} <button class="button" @click="load">Retry loading</button></p>
    <p v-if="loading" role="status">Loading observation locations…</p>
    <p v-if="tileError && online" class="distribution-notice" role="status">Some online map tiles could not load. The local Niah road/river context and available observation points remain visible. Turn Online basemap off to use local context only.</p>
    <div class="distribution-layout">
      <section class="distribution-map-panel" aria-label="Observation location map">
        <div class="distribution-map-header"><span>Recorded observation locations</span><span v-if="data" role="status">{{ stats.mapped.length }} mapped · {{ stats.species }} linked species</span><button class="button" @click="fit">Fit locations</button></div>
        <div class="distribution-map-wrap"><div ref="mapElement" class="distribution-map" aria-label="Interactive species observation map"></div><div v-if="!loading && !error && !stats.mapped.length" class="distribution-empty"><h2>No mappable observations</h2><p>Try another filter. Records need a linked species and valid GPS coordinates to appear here.</p></div></div>
        <p class="distribution-context-note">Local vector context covers the Niah area only; online tiles provide wider map context.</p>
      </section>
      <section class="panel distribution-detail" aria-live="polite"><template v-if="selected"><p class="eyebrow">SELECTED OBSERVATION</p><h2>{{ selected.common_name }}</h2><p><i>{{ selected.scientific_name }}</i></p><span class="observation-status" :data-status="selected.review_status">{{ selected.review_status === 'Pending' ? 'Pending · unverified' : 'Approved observation' }}</span><dl><div><dt>Observation</dt><dd>{{ selected.reference }}</dd></div><div><dt>Plant tag</dt><dd>{{ selected.plant_tag }}</dd></div><div><dt>Latitude</dt><dd>{{ hasCoordinates(selected) ? selected.latitude.toFixed(5) : 'Not recorded' }}</dd></div><div><dt>Longitude</dt><dd>{{ hasCoordinates(selected) ? selected.longitude.toFixed(5) : 'Not recorded' }}</dd></div><div><dt>GPS accuracy</dt><dd>{{ selected.accuracy_m == null ? 'Not supplied' : `±${selected.accuracy_m} m` }}</dd></div><div><dt>Location captured</dt><dd>{{ reviewDate(selected.location_captured_at) }}</dd></div><div><dt>Submitted</dt><dd>{{ reviewDate(selected.submitted_at) }}</dd></div><div><dt>Conservation status</dt><dd>{{ selected.conservation_status }}</dd></div></dl><p>Submitted by {{ selected.submitter_name }}</p><div class="distribution-links"><RouterLink class="button primary" :to="detailLink(`/observations/${selected.id}`)">View observation</RouterLink><RouterLink class="button" :to="detailLink(`/species/${selected.species_id}`)">View species profile</RouterLink></div><p class="distribution-small">Species information comes from the linked knowledge record. Observation approval does not independently verify identification.</p></template><template v-else><h2>Select an observation</h2><p>Choose a map marker or matching record to inspect its location evidence.</p></template></section>
    </div>
    <div class="distribution-legend" aria-label="Marker legend"><span><i style="background:#a77a32"></i>Threatened: VU / EN / CR</span><span><i style="background:#3c7355"></i>Least Concern</span><span><i style="background:#758275"></i>Other assessment</span><span><i class="distribution-hollow"></i>Pending review</span></div>
    <p v-if="data" class="distribution-notice">{{ data.summary.missing_gps }} matching linked observation(s) without valid GPS are not plotted. {{ data.summary.unlinked_count }} matching unlinked observation(s) are excluded. Points show recorded observations, not complete ranges, abundance or absence elsewhere. {{ pending ? 'Pending observations are hollow markers and unverified.' : 'Only approved observations are shown.' }}</p>
    <p v-if="data?.truncated" class="distribution-notice" role="status">Showing the newest {{ records.length }} of {{ data.summary.linked_count }} matching linked records (valid GPS first). Narrow the filters to see records beyond this limit. {{ data.summary.mapped_available }} matching records have valid GPS in total.</p>
    <section v-if="data" class="distribution-records"><h2>Matching observations</h2><p v-if="!records.length">No linked observations match these filters.</p><div v-for="record in visibleRecords" :key="record.id" class="distribution-row"><div><strong>{{ record.common_name }}</strong><small>{{ record.reference }} · {{ record.plant_tag }} · {{ record.review_status }}</small></div><button class="button" :aria-label="`${hasCoordinates(record) ? 'Locate' : 'View without GPS'} ${record.reference}`" @click="select(record, true)">{{ hasCoordinates(record) ? 'Locate' : 'View · no GPS' }}</button></div><div v-if="records.length" class="distribution-options"><span>Page {{ listPage }} of {{ listPages }}</span><div class="actions"><button class="button" :disabled="listPage <= 1" @click="listPage--">Previous</button><button class="button" :disabled="listPage >= listPages" @click="listPage++">Next</button></div></div></section>
  </div>
</template>
