<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import context from '../data/niah-context.json'
import { request } from '../services/authService'

const data = ref({ plants: [], devices: [], species: [], trail: [], assignments: [] }), busy = ref(false), saving = ref(false), error = ref(''), notice = ref(''), selected = ref(''), search = ref(''), status = ref(''), online = ref(true), tileError = ref(false), mapEl = ref(null), keyDialog = ref(null), newKey = ref('')
const plant = reactive({ id: null, version: null, species_id: '', plant_tag: '', label: '', latitude: '', longitude: '' })
const device = reactive({ id: null, version: null, device_code: '', name: '', is_active: true })
const assignment = reactive({ device_id: '', plant_id: '' })
const initialPlant = JSON.stringify(plant), initialDevice = JSON.stringify(device)
onBeforeRouteLeave(() => !saving.value && (JSON.stringify(plant) === initialPlant && JSON.stringify(device) === initialDevice || window.confirm('Discard unsaved plant or device changes?')))
let map, layer, tiles, observer, timer, controller, mounted = true, first = true, requestId = 0
function state(d) { return !Number(d.is_active) ? 'Paused' : !d.assignment_id ? 'Unassigned' : !d.reading_id ? 'Awaiting data' : Number(d.age_seconds) <= 120 ? 'Recent' : 'Stale' }
const states = ['Recent', 'Stale', 'Awaiting data', 'Unassigned', 'Paused']
const color = d => state(d) === 'Recent' ? '#1B6A53' : state(d) === 'Stale' ? '#A37632' : '#7E8B83'
const filtered = computed(() => data.value.devices.filter(d => (!status.value || state(d) === status.value) && `${d.device_code} ${d.name} ${plantFor(d)?.plant_tag || ''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const chosen = computed(() => data.value.devices.find(d => String(d.id) === selected.value))
function plantFor(d) { return data.value.plants.find(p => Number(p.id) === Number(d.plant_id)) }
function coordinates(row) { return row && row.latitude != null && row.longitude != null && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) }
function tooltip(text) { const el = document.createElement('span'); el.textContent = text; return el }
function fit() { if (!map) return; const bounds = []; data.value.plants.filter(coordinates).forEach(p => bounds.push([+p.latitude, +p.longitude])); filtered.value.filter(coordinates).forEach(d => bounds.push([+d.latitude, +d.longitude])); if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); else map.fitBounds([[3.77, 113.73], [3.85, 113.84]]) }
function draw() { if (!layer) return; layer.clearLayers(); const plantIds = new Set(filtered.value.map(d => Number(d.plant_id))); data.value.plants.filter(p => coordinates(p) && (!search.value && !status.value || plantIds.has(Number(p.id)))).forEach(p => L.circleMarker([+p.latitude, +p.longitude], { radius: 9, color: '#173F35', fillColor: '#D8E8AD', fillOpacity: 1, weight: 2 }).bindTooltip(tooltip(`Registered plant: ${p.plant_tag} · ${p.label}`)).addTo(layer)); filtered.value.filter(coordinates).forEach(d => L.circleMarker([+d.latitude, +d.longitude], { radius: String(d.id) === selected.value ? 10 : 6, color: color(d), fillColor: color(d), fillOpacity: 1, weight: 2 }).bindTooltip(tooltip(`${d.device_code} · ${state(d)}`)).on('click', () => selected.value = String(d.id)).addTo(layer)); if (chosen.value && filtered.value.some(d => d.id === chosen.value.id) && data.value.trail.length > 1) L.polyline(data.value.trail.map(p => [+p.latitude, +p.longitude]), { color: '#A37632', weight: 3, dashArray: '5 5' }).addTo(layer) }
async function load() {
  const id = ++requestId; controller?.abort(); controller = new AbortController(); const current = controller
  const requested = selected.value; busy.value = true; const timeout = setTimeout(() => current.abort(), 15000)
  try { const result = await request('/api/get_tracking.php' + (requested ? '?device_id=' + requested : ''), { signal: current.signal }); if (!mounted || id !== requestId) return; data.value = result; error.value = ''; draw(); if (first) { fit(); first = false } }
  catch (e) { if (mounted && id === requestId) error.value = e.message + ' Last loaded tracking data may be out of date.' }
  finally { clearTimeout(timeout); if (mounted && id === requestId) busy.value = false }
}
async function save(body) { if (saving.value) return; saving.value = true; error.value = ''; notice.value = ''; try { const result = await request('/api/save_tracking.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); notice.value = 'Tracking information saved.'; if (result.device_key) { newKey.value = result.device_key; await nextTick(); keyDialog.value.showModal() } await load(); return true } catch (e) { error.value = e.message; return false } finally { saving.value = false } }
function resetPlant() { Object.assign(plant, { id: null, version: null, species_id: '', plant_tag: '', label: '', latitude: '', longitude: '' }) }
function resetDevice() { Object.assign(device, { id: null, version: null, device_code: '', name: '', is_active: true }) }
async function savePlant() { if (await save({ ...plant, action: 'plant', species_id: Number(plant.species_id), latitude: plant.latitude === '' ? null : Number(plant.latitude), longitude: plant.longitude === '' ? null : Number(plant.longitude) })) resetPlant() }
async function saveDevice() { if (await save({ ...device, action: 'device' })) resetDevice() }
function editPlant(p) { Object.assign(plant, { id: p.id, version: p.version, plant_tag: p.plant_tag, label: p.label, species_id: String(p.species_id), latitude: p.latitude ?? '', longitude: p.longitude ?? '' }); document.getElementById('plant-form').scrollIntoView({ behavior: 'smooth' }) }
function editDevice(d) { Object.assign(device, { id: d.id, version: d.version, device_code: d.device_code, name: d.name, is_active: !!Number(d.is_active) }); document.getElementById('device-form').scrollIntoView({ behavior: 'smooth' }) }
async function bind() { const d = data.value.devices.find(d => String(d.id) === assignment.device_id); if (!d) return; if (window.confirm('Assign this device to the selected plant? Its previous assignment and readings will be retained.')) await save({ action: 'assign', id: d.id, version: d.version, plant_id: Number(assignment.plant_id) }) }
async function unbind(d) { if (window.confirm('End this device assignment? Historical data will be retained.')) await save({ action: 'unassign', id: d.id, version: d.version }) }
async function rotate(d) { if (window.confirm('Replace this device key? The old key will stop working immediately.')) await save({ action: 'rotate_key', id: d.id, version: d.version }) }
function closeKey() { newKey.value = ''; keyDialog.value.close() }
function locate(d) {
  selected.value = String(d.id)

  // Prefer the device's latest reported GPS coordinates.
  // If unavailable, use the registered plant coordinates.
  const p = plantFor(d)
  const point = coordinates(d)
    ? [+d.latitude, +d.longitude]
    : coordinates(p)
      ? [+p.latitude, +p.longitude]
      : null

  if (!point) {
    notice.value = 'No GPS coordinates are available for this device or its assigned plant.'
    return
  }

  if (map) {
    map.flyTo(point, 17, {
      animate: true,
      duration: 1
    })
  }

  notice.value = `Located ${d.device_code}.`
}
watch([filtered, selected], draw)
watch(selected, () => { data.value.trail = []; data.value.assignments = []; draw(); load() })
watch(online, v => { if (!map) return; if (v) { tileError.value = false; tiles.addTo(map) } else tiles.remove() })
onMounted(() => {
  map = L.map(mapEl.value, {
    scrollWheelZoom: false,
    maxZoom: 19,
    minZoom: 2
  })

  // Local Niah context overlay
  L.geoJSON(context, {
    style: feature => ({
      color: feature.properties.kind === 'water' ? '#8BAFBD' : '#B1B89C',
      weight: 1,
      fillColor: '#DFE9D2',
      fillOpacity: 0.5
    }),
    interactive: false,
    attribution: 'Local Niah context © OpenStreetMap contributors'
  }).addTo(map)

  // Online OpenStreetMap basemap
  tiles = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  )

  tiles.on('tileerror', () => {
    tileError.value = true
  })

  tiles.on('tileload', () => {
    tileError.value = false
  })

  // Add online basemap immediately
  tiles.addTo(map)

  layer = L.layerGroup().addTo(map)

  map.fitBounds([[3.77, 113.73], [3.85, 113.84]])

  observer = new ResizeObserver(() => map?.invalidateSize())
  observer.observe(mapEl.value)

  load()

  timer = setInterval(() => {
    if (!document.hidden && !busy.value) load()
  }, 30000)
})
onBeforeUnmount(() => { mounted = false; controller?.abort(); clearInterval(timer); observer?.disconnect(); map?.remove(); newKey.value = '' })
</script>

<template>
  <div class="tracking-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">PLANT PROTECTION</p>
        <h1>Plant & sensor tracking</h1>
        <p>Connect individual plants to devices and inspect their latest reported positions.</p>
      </div><button class="button primary" :disabled="busy" @click="load">{{ busy ? 'Refreshing…' : 'Refresh tracking'
      }}</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="tracking-notice" role="status">{{ notice }}</p>
    <p v-if="data.limited" class="error">Showing the first 1,000 plants, devices or species. Narrower server-side paging
      is required for larger inventories.</p>
    <div class="tracking-stats">
      <article><span>Registered plants</span><strong>{{ data.plants.length }}</strong></article>
      <article><span>Devices</span><strong>{{ data.devices.length }}</strong></article>
      <article><span>Recent reports</span><strong>{{data.devices.filter(d => state(d) === 'Recent').length}}</strong>
      </article>
      <article><span>Awaiting assignment</span><strong>{{data.devices.filter(d => !d.assignment_id).length}}</strong>
      </article>
    </div>
    <section class="panel tracking-panel">
      <div class="tracking-filters"><label>Find device or plant tag<input v-model="search" type="search"
            placeholder="Device code, name or plant tag"></label><label>Device status<select v-model="status"
            aria-label="Device status">
            <option value="">All statuses</option>
            <option v-for="s in states" :key="s">{{ s }}</option>
          </select></label><button class="button" @click="fit">Fit locations</button><label><input v-model="online"
            type="checkbox"> Online basemap</label></div>
      <p v-if="tileError" class="error">Online tiles are unavailable. Local Niah context remains visible.</p>
      <div ref="mapEl" class="tracking-map" aria-label="Individual plant and device tracking map"></div>
      <p class="tracking-caption">Light green: registered plant · Dark green: report within 2 minutes · Amber: older
        report · Grey: paused device. Refreshes every 30 seconds while visible. Recency is based on report receipt, not
        a connectivity check. Missing GPS is never placed at a guessed location.</p>
      <div class="tracking-filters"><label>Inspect device<select v-model="selected" aria-label="Inspect device">
            <option value="">Choose a device</option>
            <option v-for="d in filtered" :key="d.id" :value="String(d.id)">{{ d.device_code }} · {{ state(d) }}
            </option>
          </select></label></div>
      <div v-if="chosen" class="tracking-inspector">
        <h2>{{ chosen.name }} · {{ chosen.device_code }}</h2>
        <p>Plant: {{ plantFor(chosen)?.plant_tag || 'Unassigned' }} · {{ state(chosen) }}</p>
        <p>{{ chosen.recorded_at ? `Latest receipt: ${chosen.recorded_at}` : 'No reading for the current assignment.' }}
        </p>
        <p v-if="coordinates(chosen)">Reported GPS: {{ chosen.latitude }}, {{ chosen.longitude }} · {{
          chosen.temperature }} °C · {{ chosen.humidity }} %</p>
        <p class="tracking-caption">Dashed trail: up to 100 received GPS reports from the current assignment, in receipt
          order. It does not imply continuous movement. Registered plant coordinates and reported device coordinates are
          shown separately.</p>
        <details>
          <summary>Assignment history</summary>
          <ul>
            <li v-for="a in data.assignments" :key="a.id">{{ a.plant_tag }} · {{ a.started_at }} → {{ a.ended_at ||
              'Current' }}</li>
          </ul>
        </details>
      </div>
      <p v-if="!data.devices.length" class="empty">No devices registered. Add a plant and device below to begin.</p>
    </section>
    <section class="panel tracking-panel">
      <h2>Device assignments</h2>
      <form class="tracking-filters" @submit.prevent="bind"><label>Device<select v-model="assignment.device_id"
            aria-label="Assignment device" required>
            <option value="">Select device</option>
            <option v-for="d in data.devices" :key="d.id" :value="String(d.id)">{{ d.device_code }}</option>
          </select></label><label>Individual plant<select v-model="assignment.plant_id" aria-label="Assignment plant"
            required>
            <option value="">Select plant</option>
            <option v-for="p in data.plants" :key="p.id" :value="String(p.id)">{{ p.plant_tag }} · {{ p.label }}
            </option>
          </select></label><button class="button primary" :disabled="saving">Assign device</button></form>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Plant</th>
              <th>Status</th>
              <th>Last report</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in filtered" :key="d.id">
              <td>{{ d.device_code }}<br>{{ d.name }}</td>
              <td>{{ plantFor(d)?.plant_tag || 'Unassigned' }}</td>
              <td>{{ state(d) }}</td>
              <td>{{ d.recorded_at || 'No report' }}</td>
              <td>
                <div class="tracking-actions">
                  <button class="button" @click="locate(d)">Locate</button>
                  <button class="button" :disabled="saving" @click="editDevice(d)">Edit</button>
                  <button v-if="d.assignment_id" class="button" :disabled="saving" @click="unbind(d)">Unassign</button>
                  <button class="button" :disabled="saving" @click="rotate(d)">Replace key</button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="5">No devices match these filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <div class="tracking-forms">
      <section id="plant-form" class="panel tracking-panel">
        <h2>{{ plant.id ? 'Edit individual plant' : 'Register individual plant' }}</h2>
        <form @submit.prevent="savePlant"><label>Plant tag<input v-model="plant.plant_tag" required maxlength="64"
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,63}"></label><label>Plant label<input v-model="plant.label" required
              maxlength="120"></label><label>Species<select v-model="plant.species_id" aria-label="Plant species"
              required :disabled="!!plant.id">
              <option value="">Select species</option>
              <option v-for="s in data.species" :key="s.species_id" :value="String(s.species_id)">{{ s.common_name }} ·
                {{ s.scientific_name }}</option>
            </select></label>
          <div class="tracking-coordinates"><label>Registered latitude<input v-model="plant.latitude" type="number"
                step="any" min="-90" max="90"></label><label>Registered longitude<input v-model="plant.longitude"
                type="number" step="any" min="-180" max="180"></label></div>
          <p class="tracking-caption">Coordinates are optional; enter both or leave both empty.</p>
          <div class="tracking-actions"><button class="button primary" :disabled="saving">Save plant</button><button
              type="button" class="button" @click="resetPlant">Clear plant form</button></div>
        </form>
      </section>
      <section id="device-form" class="panel tracking-panel">
        <h2>{{ device.id ? 'Edit device' : 'Register device' }}</h2>
        <form @submit.prevent="saveDevice"><label>Device code<input v-model="device.device_code" required maxlength="64"
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,63}"></label><label>Device name<input v-model="device.name" required
              maxlength="120"></label><label class="tracking-checkbox"><input v-model="device.is_active"
              type="checkbox"> Device enabled</label>
          <p class="tracking-caption">Disabled devices cannot upload. A private device key is shown once when
            registering or replacing a key.</p>
          <div class="tracking-actions"><button class="button primary" :disabled="saving">Save device</button><button
              type="button" class="button" @click="resetDevice">Clear device form</button></div>
        </form>
      </section>
    </div>
    <section class="panel tracking-panel">
      <h2>Individual plants</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Plant</th>
              <th>Species</th>
              <th>Registered GPS</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in data.plants" :key="p.id">
              <td>{{ p.plant_tag }}</td>
              <td>{{ p.label }}</td>
              <td>{{ p.common_name }}</td>
              <td>{{ coordinates(p) ? `${p.latitude}, ${p.longitude}` : 'Not recorded' }}</td>
              <td><button class="button" @click="editPlant(p)">Edit plant</button></td>
            </tr>
            <tr v-if="!data.plants.length">
              <td colspan="5">No individual plants registered.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <dialog ref="keyDialog" aria-labelledby="device-key-title" @cancel.prevent="closeKey">
      <h2 id="device-key-title">Save this device key</h2>
      <p>This key is shown only once. Store it securely for the device team. It grants upload access for this device.
      </p><code class="tracking-key">{{ newKey }}</code><button class="button primary" @click="closeKey">I have saved
        the key</button>
    </dialog>
  </div>
</template>
<style scoped>
.tracking-page {
  color: #203C33;
}

.tracking-panel {
  padding: 24px;
  margin-bottom: 24px;
}

.tracking-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.tracking-stats article {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid #DCE5D9;
  border-radius: 12px;
  background: #F5F7F0;
}

.tracking-stats span,
.tracking-caption {
  color: #64756C;
  font-size: 13px;
  line-height: 1.6;
}

.tracking-stats strong {
  font-size: 30px;
  color: #173F35;
}

.tracking-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
  margin-bottom: 16px;
}

.tracking-filters label {
  min-width: 0;
}

.tracking-map {
  background: #F3F5E9;
  height: 460px;
  border: 1px solid #DCE5D9;
  border-radius: 12px;
  z-index: 0;
}

.tracking-forms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.tracking-panel form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
}

.tracking-panel input,
.tracking-panel select {
  max-width: 100%;
  min-width: 0;
  border: 1px solid #DCE2D9;
  border-radius: 8px;
  padding: 10px;
  color: #203C33;
  background: white;
}

.tracking-actions,
.tracking-coordinates {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tracking-coordinates label {
  flex: 1;
  min-width: 120px;
}

.tracking-panel form .tracking-checkbox {
  flex-direction: row;
  align-items: center;
}

.tracking-panel input[type=checkbox] {
  width: 18px;
  min-width: 18px;
  height: 18px;
  min-height: 18px;
  padding: 0;
  accent-color: #1B5E4B;
}

.tracking-filters label:has(input[type=checkbox]) {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.tracking-inspector {
  padding: 18px;
  background: #F5F7F0;
  border-radius: 10px;
}

.tracking-notice {
  padding: 12px;
  background: #EAF0E1;
}

.tracking-key {
  display: block;
  overflow-wrap: anywhere;
  padding: 16px;
  background: #F5F7F0;
  margin: 20px 0;
  user-select: all;
}

dialog {
  max-width: min(560px, calc(100vw - 32px));
  border: 1px solid #DCE5D9;
  border-radius: 12px;
  padding: 24px;
}

summary {
  cursor: pointer;
}

@media(max-width:900px) {
  .tracking-stats {
    grid-template-columns: 1fr 1fr
  }

  .tracking-forms {
    grid-template-columns: 1fr
  }
}

@media(max-width:500px) {
  .tracking-panel {
    padding: 16px
  }

  .tracking-map {
    height: 360px
  }

  .tracking-filters {
    align-items: stretch;
    flex-direction: column
  }
}
</style>
