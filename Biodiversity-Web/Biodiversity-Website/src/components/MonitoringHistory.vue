<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { request } from '../services/authService'

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
function daysBefore(date, days) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10) }
const filters = reactive({ start: daysBefore(today(), 29), end: today(), species_id: '' })
const result = ref(null), busy = ref(false), error = ref(''), metric = ref('temperature')
let controller, generation = 0, mounted = true
const metrics = { temperature: { label: 'Temperature', unit: '°C', color: '#1B5E4B' }, humidity: { label: 'Humidity', unit: '%', color: '#608747' }, distance_cm: { label: 'Distance', unit: 'cm', color: '#977240' } }
const active = computed(() => metrics[metric.value])
const dirty = computed(() => result.value && Object.entries(filters).some(([k, v]) => String(result.value.range[k] ?? '') !== String(v)))
const number = value => value == null ? '—' : Number(value).toFixed(1)
async function load(page = 1, savedRange = null) {
  const range = savedRange || { ...filters }
  if (!range.start || !range.end || range.start > range.end) { error.value = 'Choose a valid start date and an end date on or after it.'; return }
  const id = ++generation
  controller?.abort(); controller = new AbortController()
  const localController = controller
  const timeout = setTimeout(() => localController.abort(), 15000)
  busy.value = true; error.value = ''
  try {
    const params = new URLSearchParams({ ...range, species_id: range.species_id ?? '', page })
    const data = await request('/api/get_monitoring_history.php?' + params, { signal: localController.signal })
    if (!mounted || id !== generation) return
    if (!data.summary || !Array.isArray(data.trend) || !Array.isArray(data.readings)) throw Error('Invalid history response.')
    result.value = data
  } catch (e) { if (mounted && id === generation) error.value = (e.status === 400 ? e.message : 'History could not be loaded. Please retry.') + (result.value ? ' Previous results are still displayed.' : '') }
  finally { clearTimeout(timeout); if (mounted && id === generation) busy.value = false }
}
function preset(days) { filters.end = today(); filters.start = daysBefore(filters.end, days - 1); load() }
onMounted(() => load())
onBeforeUnmount(() => { mounted = false; generation++; controller?.abort() })
const plot = computed(() => {
  const rows = result.value?.trend || []
  if (!rows.length) return null
  const values = rows.map(r => r[metric.value]), low = Math.min(...values), high = Math.max(...values)
  const pad = Math.max((high - low) * .15, 1), min = low - pad, max = high + pad
  const times = rows.map(r => Date.parse(r.bucket + 'T00:00:00Z'))
  const points = rows.map((r, i) => ({ ...r, x: times.length === 1 ? 430 : 70 + (times[i] - times[0]) / (times.at(-1) - times[0]) * 720, y: 230 - (r[metric.value] - min) / (max - min) * 190 }))
  const segments = []
  for (let i = 1; i < points.length; i++) {
    const previous = new Date(times[i - 1]); if (result.value.interval === 'month') previous.setUTCMonth(previous.getUTCMonth() + 1); else previous.setUTCDate(previous.getUTCDate() + 1)
    if (+previous === times[i]) segments.push({ a: points[i - 1], b: points[i] })
  }
  return { points, segments, ticks: [0, 1, 2, 3, 4].map(i => ({ y: 230 - i * 47.5, value: min + i * (max - min) / 4 })), labels: [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => points[i]) }
})
</script>

<template>
  <section class="panel ecological-history" aria-labelledby="history-title">
    <div class="section-heading"><div><p class="eyebrow">ECOLOGICAL INSIGHTS</p><h2 id="history-title">Historical data & trends</h2><p>Explore environmental measurements over time.</p></div><span class="history-tag">Historical analysis</span></div>
    <form class="history-form" @submit.prevent="load()">
      <label>Start date<input v-model="filters.start" type="date" required :disabled="busy"></label>
      <label>End date<input v-model="filters.end" type="date" required :min="filters.start" :disabled="busy"></label>
      <label>Species<select aria-label="History species" v-model="filters.species_id" :disabled="busy"><option value="">All species</option><option v-for="species in result?.species || []" :key="species.species_id" :value="String(species.species_id)">{{ species.common_name || 'Species' }} · #{{ species.species_id }}</option></select></label>
      <button type="submit" class="button primary" :disabled="busy">{{ busy ? 'Loading history…' : 'Apply range' }}</button>
    </form>
    <div class="history-presets"><span>Quick range</span><button v-for="days in [7, 30, 90, 365]" :key="days" type="button" class="button" :disabled="busy" @click="preset(days)">Last {{ days }} days</button></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="dirty" class="history-hint" role="status">Filters changed. Apply the range to update the results below.</p>
    <template v-if="result">
      <p class="history-caption">{{ result.range.start }} → {{ result.range.end }} · {{ result.range.species_id ? `Species #${result.range.species_id}` : 'All species combined' }} · {{ result.time_basis }} · Inclusive dates</p>
      <div class="history-metrics">
        <article><span>Measurements</span><strong>{{ result.summary.count.toLocaleString() }}</strong><small>Within the selected range</small></article>
        <article><span>Mean temperature</span><strong>{{ number(result.summary.avg_temperature) }} <small>°C</small></strong><small>Min {{ number(result.summary.min_temperature) }} / Max {{ number(result.summary.max_temperature) }} °C</small></article>
        <article><span>Mean humidity</span><strong>{{ number(result.summary.avg_humidity) }} <small>%</small></strong><small>Min {{ number(result.summary.min_humidity) }} / Max {{ number(result.summary.max_humidity) }} %</small></article>
        <article><span>Mean distance</span><strong>{{ number(result.summary.avg_distance_cm) }} <small>cm</small></strong><small>Distance sensor measurements</small></article>
      </div>
      <div class="history-chart-heading"><div><h3>Environmental trend</h3><p>{{ result.interval === 'month' ? 'Monthly' : 'Daily' }} averages · Gaps indicate missing measurements.</p></div><label>Trend metric<select aria-label="Trend metric" v-model="metric"><option v-for="(item, key) in metrics" :value="key" :key="key">{{ item.label }} ({{ item.unit }})</option></select></label></div>
      <div v-if="!plot" class="empty">No measurements in this date range. Try another range or species.</div>
      <div v-else class="history-chart" tabindex="0" aria-label="Scrollable environmental trend">
        <svg viewBox="0 0 860 285" role="img" :aria-label="`${active.label} ${result.interval} averages in ${active.unit}. ${result.trend.length} periods with data. Exact values are in the trend data table.`">
          <title>{{ active.label }} trend ({{ active.unit }})</title>
          <g v-for="tick in plot.ticks" :key="tick.y"><line x1="70" x2="790" :y1="tick.y" :y2="tick.y" stroke="#DCE5D9"/><text x="60" :y="tick.y + 4" text-anchor="end">{{ number(tick.value) }}</text></g>
          <text x="70" y="20">{{ active.unit }}</text>
          <line v-for="(segment, i) in plot.segments" :key="i" :x1="segment.a.x" :y1="segment.a.y" :x2="segment.b.x" :y2="segment.b.y" :stroke="active.color" stroke-width="3"/>
          <circle v-for="point in plot.points" :key="point.bucket" :cx="point.x" :cy="point.y" r="4" :fill="active.color"><title>{{ point.bucket }}: {{ number(point[metric]) }} {{ active.unit }} · {{ point.count }} measurements</title></circle>
          <text v-for="point in plot.labels" :key="point.bucket" :x="point.x" y="260" text-anchor="middle">{{ point.bucket }}</text>
        </svg>
      </div>
      <p class="history-hint">Averages describe recorded measurements, not continuous conditions. All-species results combine locations; select a species for a narrower comparison. History updates when you apply a range; live auto-refresh does not replace this snapshot.</p>
      <details v-if="result.trend.length"><summary>View trend data table</summary><div class="table-scroll"><table><thead><tr><th>Period</th><th>Measurements</th><th>Mean temperature (°C)</th><th>Mean humidity (%)</th><th>Mean distance (cm)</th></tr></thead><tbody><tr v-for="point in result.trend" :key="point.bucket"><td>{{ point.bucket }}</td><td>{{ point.count }}</td><td>{{ number(point.temperature) }}</td><td>{{ number(point.humidity) }}</td><td>{{ number(point.distance_cm) }}</td></tr></tbody></table></div></details>
      <h3>Historical measurements</h3>
      <div class="table-scroll"><table><thead><tr><th>Recorded at</th><th>Species ID</th><th>Temperature (°C)</th><th>Humidity (%)</th><th>Distance (cm)</th><th>GPS</th></tr></thead><tbody><tr v-for="row in result.readings" :key="row.reading_id"><td>{{ row.recorded_at }}</td><td>{{ row.species_id }}</td><td>{{ number(row.temperature) }}</td><td>{{ number(row.humidity) }}</td><td>{{ number(row.distance_cm) }}</td><td>{{ row.latitude }}, {{ row.longitude }}</td></tr><tr v-if="!result.readings.length"><td colspan="6">No historical measurements found.</td></tr></tbody></table></div>
      <div class="history-pagination"><button class="button" :disabled="busy || dirty || result.page <= 1" @click="load(result.page - 1, result.range)">Previous</button><span>Page {{ result.page }} of {{ result.pages }} · 50 measurements per page</span><button class="button" :disabled="busy || dirty || result.page >= result.pages" @click="load(result.page + 1, result.range)">Next</button></div>
    </template>
  </section>
</template>

<style scoped>
.ecological-history { margin-top: 0; padding: 24px; min-width: 0; max-width: 100%; color: #203C33; }
.table-scroll { max-height: 420px; overflow: auto; }
th { position: sticky; top: 0; background: #F5F7F0; }
.history-tag { border-radius: 20px; padding: 7px 12px; background: #EAF0E1; color: #34664B; font-size: 12px; }
.history-form { display: grid; grid-template-columns: 1fr 1fr 1.4fr auto; align-items: end; gap: 16px; margin: 20px 0 12px; }
.history-form label,.history-chart-heading label { display: flex; flex-direction: column; gap: 7px; font-size: 13px; min-width: 0; }
input,select { max-width: 100%; min-width: 0; border: 1px solid #DCE2D9; border-radius: 8px; background: #FFF; padding: 10px; color: #203C33; }
.history-presets,.history-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12px; }
.history-presets .button { padding: 6px 12px; min-height: 36px; }
.history-caption,.history-hint { color: #64756C; font-size: 13px; line-height: 1.6; }
.history-caption { margin-top: 22px; }
.history-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; margin: 16px 0 26px; }
.history-metrics article { display: flex; flex-direction: column; gap: 8px; padding: 18px; background: #F5F7F0; border: 1px solid #E0E6DA; border-radius: 12px; }
.history-metrics span,.history-metrics small { color: #64756C; font-size: 12px; }
.history-metrics strong { font-size: 28px; color: #173F35; }
.history-chart-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.history-chart-heading p { color: #64756C; font-size: 13px; }
.history-chart { border: 1px solid #DCE5D9; border-radius: 12px; background: #FCFDF9; margin: 14px 0; overflow-x: auto; }
svg { display: block; width: 100%; min-width: 480px; }
svg text { font-size: 12px; fill: #64756C; }
details { margin: 20px 0; } summary { cursor: pointer; color: #1B5E4B; padding: 10px 0; }
.history-pagination { justify-content: flex-end; margin-top: 16px; }
@media(max-width:900px) { .history-form { grid-template-columns: repeat(2,minmax(0,1fr)); } .history-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:500px) { .ecological-history { padding: 16px; } .history-form { grid-template-columns: 1fr; } .history-metrics article { padding: 12px; } .history-metrics strong { font-size: 23px; } }
</style>
