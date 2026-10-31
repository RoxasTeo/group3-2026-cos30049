<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { request } from '../services/authService'
import MonitoringHistory from '../components/MonitoringHistory.vue'
import ThreatDetectionRules from '../components/ThreatDetectionRules.vue'

const readingsList = ref([])
const alertsList = ref([])
const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const severityFilter = ref('all')

const lastUpdated = ref(null)
const autoRefresh = ref(true)
let timer, controller, mounted = true
const refreshInterval = 30000

async function fetchMonitoringData() {
  if (loading.value || !mounted) return
  loading.value = true
  errorMessage.value = ''
  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), 15000)
  try {
    const [readingsData, alertsData] = await Promise.all([
      request('/api/get_sensor_readings.php', { signal: controller.signal }),
      request('/api/get_threat_alerts.php', { signal: controller.signal })
    ])
    if (!mounted) return
    if (!Array.isArray(readingsData) || !Array.isArray(alertsData)) throw new Error('Invalid monitoring response')
    readingsList.value = readingsData
    alertsList.value = alertsData
    lastUpdated.value = new Date()
  } catch (error) {
    controller?.abort()
    if (mounted) errorMessage.value = lastUpdated.value
      ? 'Refresh failed. Showing the last successfully loaded data; it may be out of date.'
      : 'Unable to load monitoring data. Check your connection and try Refresh Data.'
  } finally {
    clearTimeout(timeout)
    if (mounted) loading.value = false
  }
}
function refreshIfVisible() {
  if (autoRefresh.value && !document.hidden) fetchMonitoringData()
}
onMounted(() => {
  fetchMonitoringData()
  timer = setInterval(refreshIfVisible, refreshInterval)
  document.addEventListener('visibilitychange', refreshIfVisible)
})
onBeforeUnmount(() => {
  mounted = false
  clearInterval(timer)
  controller?.abort()
  document.removeEventListener('visibilitychange', refreshIfVisible)
})

// Latest sensor reading
const latestReading = computed(() => {
  if (!readingsList.value.length) return null

  return [...readingsList.value].sort(
    (a, b) =>
      new Date(b.recorded_at.replace(' ', 'T')) -
      new Date(a.recorded_at.replace(' ', 'T'))
  )[0]
})

// Alert summary
const totalAlerts = computed(() => alertsList.value.length)

const criticalAlerts = computed(() =>
  alertsList.value.filter(
    alert => String(alert.severity).toLowerCase() === 'critical'
  ).length
)

const warningAlerts = computed(() =>
  alertsList.value.filter(
    alert => String(alert.severity).toLowerCase() === 'warning'
  ).length
)

const infoAlerts = computed(() =>
  alertsList.value.filter(
    alert => String(alert.severity).toLowerCase() === 'info'
  ).length
)

// Search and severity filtering
const filteredAlerts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return alertsList.value.filter(alert => {
    const matchesSeverity =
      severityFilter.value === 'all' ||
      String(alert.severity).toLowerCase() === severityFilter.value

    const searchableText = [
      alert.species_id, alert.plant_tag, alert.device_code,
      alert.alert_type,
      alert.message,
      alert.severity,
      alert.latitude,
      alert.longitude
    ].join(' ').toLowerCase()

    return matchesSeverity && searchableText.includes(query)
  })
})

// Display newest readings first
const recentReadings = computed(() =>
  [...readingsList.value]
    .sort(
      (a, b) =>
        new Date(b.recorded_at.replace(' ', 'T')) -
        new Date(a.recorded_at.replace(' ', 'T'))
    )
    .slice(0, 10)
)

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(String(value).replace(' ', 'T'))

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const number = Number(value)

  return Number.isFinite(number) ? number.toFixed(decimals) : '—'
}

function severityClass(severity) {
  switch (String(severity ?? '').toLowerCase()) {
    case 'critical':
      return 'severity-critical'
    case 'warning':
      return 'severity-warning'
    case 'info':
      return 'severity-info'
    default:
      return ''
  }
}
</script>

<template>
  <div class="monitoring-dashboard">
    <div class="page-heading">
      <div>
        <p class="eyebrow">NIAH BIODIVERSITY SYSTEM</p>
        <h1>Centralized Monitoring Dashboard</h1>
        <p>
          Monitor environmental readings and review detected threats.
        </p>
      </div>

      <button
        class="button primary"
        :disabled="loading"
        @click="fetchMonitoringData"
      >
        {{ loading ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>

    <div v-if="errorMessage" class="alert error">
      {{ errorMessage }}
    </div>

    <div class="monitoring-refresh" role="status">
      <label><input v-model="autoRefresh" type="checkbox" @change="refreshIfVisible"> Auto-refresh every 30 seconds</label>
      <span>{{ loading ? 'Refreshing…' : lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'No successful update yet' }}</span>
      <small>Refresh pauses while this tab is hidden.</small>
    </div>

    <!-- Environmental and threat summary -->
    <section class="monitoring-summary">
      <article class="metric-card">
        <div class="metric-icon">🌡️</div>
        <div>
          <p>Temperature</p>
          <h2>
            {{ formatNumber(latestReading?.temperature) }}
            <span>°C</span>
          </h2>
          <small>Latest sensor reading</small>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon">💧</div>
        <div>
          <p>Humidity</p>
          <h2>
            {{ formatNumber(latestReading?.humidity) }}
            <span>%</span>
          </h2>
          <small>Latest sensor reading</small>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon">🛡️</div>
        <div>
          <p>Total Threat Alerts</p>
          <h2>{{ totalAlerts }}</h2>
          <small>Recorded alerts</small>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon">⚠️</div>
        <div>
          <p>Critical Alerts</p>
          <h2>{{ criticalAlerts }}</h2>
          <small>Alerts marked critical</small>
        </div>
      </article>
    </section>

    <MonitoringHistory />

    <ThreatDetectionRules />

    <!-- Additional summary -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Threat Overview</h2>
          <p>Recorded alerts grouped by severity.</p>
        </div>
      </div>

      <div class="threat-overview">
        <div class="threat-overview-item">
          <span class="status-pill severity-critical">Critical</span>
          <strong>{{ criticalAlerts }}</strong>
        </div>

        <div class="threat-overview-item">
          <span class="status-pill severity-warning">Warning</span>
          <strong>{{ warningAlerts }}</strong>
        </div>

        <div class="threat-overview-item">
          <span class="status-pill severity-info">Info</span>
          <strong>{{ infoAlerts }}</strong>
        </div>
      </div>
    </section>

    <!-- Latest sensor details -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Latest Sensor Reading</h2>
          <p>Most recent environmental measurement received.</p>
        </div>
      </div>

      <div v-if="latestReading" class="reading-details">
        <div>
          <span>Species ID</span>
          <strong>{{ latestReading.species_id }}</strong>
        </div>

        <div>
          <span>Temperature</span>
          <strong>
            {{ formatNumber(latestReading.temperature) }} °C
          </strong>
        </div>

        <div>
          <span>Humidity</span>
          <strong>
            {{ formatNumber(latestReading.humidity) }} %
          </strong>
        </div>

        <div>
          <span>Distance</span>
          <strong>
            {{ formatNumber(latestReading.distance_cm, 2) }} cm
          </strong>
        </div>

        <div>
          <span>Latitude</span>
          <strong>{{ latestReading.latitude }}</strong>
        </div>

        <div>
          <span>Longitude</span>
          <strong>{{ latestReading.longitude }}</strong>
        </div>

        <div>
          <span>Recorded At</span>
          <strong>{{ formatDate(latestReading.recorded_at) }}</strong>
        </div>
      </div>

      <div v-else class="empty">
        No sensor readings are available.
      </div>
    </section>

    <!-- Threat alerts -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Threat Alerts</h2>
          <p>Review alerts recorded by the monitoring system.</p>
        </div>

        <span class="result-count">
          {{ filteredAlerts.length }} result(s)
        </span>
      </div>

      <div class="filters">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search species, threat, message or location..."
          aria-label="Search threat alerts"
        />

        <select v-model="severityFilter" aria-label="Filter by severity">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Species ID</th>
              <th>Threat Type</th>
              <th>Message</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="alert in filteredAlerts"
              :key="alert.alert_id"
            >
              <td>{{ alert.species_id }}<small v-if="alert.plant_tag" style="display:block">{{ alert.plant_tag }} · {{ alert.device_code }}</small></td>
              <td>{{ alert.alert_type }}</td>
              <td>{{ alert.message }}</td>
              <td>
                <span
                  class="status-pill"
                  :class="severityClass(alert.severity)"
                >
                  {{ alert.severity }}
                </span>
              </td>
              <td>
                {{ alert.latitude }}, {{ alert.longitude }}
              </td>
              <td>{{ formatDate(alert.created_at) }}</td>
            </tr>

            <tr v-if="!filteredAlerts.length">
              <td colspan="6" class="empty">
                No matching threat alerts found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Sensor history -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Recent Sensor Readings</h2>
          <p>Latest 10 readings received from the monitoring system.</p>
        </div>

        <span class="result-count">
          {{ readingsList.length }} total reading(s)
        </span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Species ID</th>
              <th>Temperature</th>
              <th>Humidity</th>
              <th>Distance</th>
              <th>Location</th>
              <th>Recorded At</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="reading in recentReadings"
              :key="reading.reading_id"
            >
              <td>{{ reading.species_id }}<small v-if="reading.plant_tag" style="display:block">{{ reading.plant_tag }} · {{ reading.device_code }}</small></td>
              <td>{{ formatNumber(reading.temperature) }} °C</td>
              <td>{{ formatNumber(reading.humidity) }} %</td>
              <td>{{ formatNumber(reading.distance_cm, 2) }} cm</td>
              <td>
                {{ reading.latitude }}, {{ reading.longitude }}
              </td>
              <td>{{ formatDate(reading.recorded_at) }}</td>
            </tr>

            <tr v-if="!recentReadings.length">
              <td colspan="6" class="empty">
                No sensor readings are available.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p v-if="loading" class="loading-message">
      Loading monitoring data...
    </p>
  </div>
</template>

<style scoped>
.monitoring-refresh { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin-bottom: 20px; color: #456255; font-size: 14px; }
.monitoring-refresh label { display: flex; align-items: center; gap: 8px; }
.monitoring-refresh input { width: auto; }
@media(max-width:900px) { .monitoring-summary { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:450px) { .monitoring-summary { grid-template-columns: 1fr; } }
</style>
