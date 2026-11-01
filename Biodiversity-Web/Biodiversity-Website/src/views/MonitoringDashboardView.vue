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

const lastUpdated = ref(null)
const autoRefresh = ref(true)

let timer
let controller
let mounted = true

const refreshInterval = 30000

// ==========================================
// FETCH MONITORING DATA
// ==========================================

async function fetchMonitoringData() {
  if (loading.value || !mounted) return

  loading.value = true
  errorMessage.value = ''

  controller = new AbortController()

  const timeout = setTimeout(() => {
    controller?.abort()
  }, 15000)

  try {
    const [readingsData, alertsData] = await Promise.all([
      request('/api/get_sensor_readings.php', {
        signal: controller.signal
      }),

      request('/api/get_threat_alerts.php', {
        signal: controller.signal
      })
    ])

    if (!mounted) return

    if (
      !Array.isArray(readingsData) ||
      !Array.isArray(alertsData)
    ) {
      throw new Error('Invalid monitoring response')
    }

    readingsList.value = readingsData
    alertsList.value = alertsData

    lastUpdated.value = new Date()

  } catch (error) {

    controller?.abort()

    if (mounted) {
      errorMessage.value = lastUpdated.value
        ? 'Refresh failed. Showing the last successfully loaded data; it may be out of date.'
        : 'Unable to load monitoring data. Check your connection and try Refresh Data.'
    }

  } finally {

    clearTimeout(timeout)

    if (mounted) {
      loading.value = false
    }
  }
}

// ==========================================
// AUTO REFRESH
// ==========================================

function refreshIfVisible() {
  if (autoRefresh.value && !document.hidden) {
    fetchMonitoringData()
  }
}

onMounted(() => {
  fetchMonitoringData()

  timer = setInterval(
    refreshIfVisible,
    refreshInterval
  )

  document.addEventListener(
    'visibilitychange',
    refreshIfVisible
  )
})

onBeforeUnmount(() => {
  mounted = false

  clearInterval(timer)

  controller?.abort()

  document.removeEventListener(
    'visibilitychange',
    refreshIfVisible
  )
})

// ==========================================
// LATEST SENSOR READING
// ==========================================

const latestReading = computed(() => {

  if (!readingsList.value.length) {
    return null
  }

  return [...readingsList.value].sort(
    (a, b) =>
      new Date(b.recorded_at.replace(' ', 'T')) -
      new Date(a.recorded_at.replace(' ', 'T'))
  )[0]
})

// ==========================================
// ALERT SUMMARY
// ==========================================

const totalAlerts = computed(() =>
  alertsList.value.length
)

// ==========================================
// SEARCH THREAT ALERTS
// ==========================================

const filteredAlerts = computed(() => {

  const query = searchQuery.value.trim().toLowerCase()

  return alertsList.value.filter(alert => {

    const searchableText = [
      alert.plant_id,
      alert.tracking_assignment_id,
      alert.alert_type,
      alert.message
    ]
      .map(value => value ?? '')
      .join(' ')
      .toLowerCase()

    return searchableText.includes(query)
  })
})

// ==========================================
// DISPLAY NEWEST READINGS FIRST
// ==========================================

const recentReadings = computed(() => {

  return [...readingsList.value]
    .sort(
      (a, b) =>
        new Date(b.recorded_at.replace(' ', 'T')) -
        new Date(a.recorded_at.replace(' ', 'T'))
    )
    .slice(0, 10)
})

// ==========================================
// FORMATTING FUNCTIONS
// ==========================================

function formatDate(value) {

  if (!value) return '—'

  const date = new Date(
    String(value).replace(' ', 'T')
  )

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatNumber(value, decimals = 1) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  const number = Number(value)

  return Number.isFinite(number)
    ? number.toFixed(decimals)
    : '—'
}

function formatSoilMoisture(value) {

  if (value === null || value === undefined) {
    return 'Not calibrated'
  }

  return `${formatNumber(value)} %`
}

</script>

<template>
  <div class="monitoring-dashboard">

    <!-- ================================== -->
    <!-- PAGE HEADING -->
    <!-- ================================== -->

    <div class="page-heading">

      <div>
        <p class="eyebrow">
          NIAH BIODIVERSITY SYSTEM
        </p>

        <h1>Centralized Monitoring Dashboard</h1>

        <p>
          Monitor environmental readings and review detected threats.
        </p>
      </div>

      <button class="button primary" :disabled="loading" @click="fetchMonitoringData">
        {{ loading ? 'Refreshing...' : 'Refresh Data' }}
      </button>

    </div>

    <!-- ================================== -->
    <!-- ERROR MESSAGE -->
    <!-- ================================== -->

    <div v-if="errorMessage" class="alert error">
      {{ errorMessage }}
    </div>

    <!-- ================================== -->
    <!-- REFRESH STATUS -->
    <!-- ================================== -->

    <div class="monitoring-refresh" role="status">

      <div class="refresh-left">
        <label>
          <span>Auto-refresh every 30 seconds</span>
        </label>
      </div>

      <div class="refresh-right">
        <span>
          {{
            loading
              ? 'Refreshing…'
              : lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : 'No successful update yet'
          }}
        </span>

        <small>
          Refresh pauses while this tab is hidden.
        </small>
      </div>

    </div>

    <!-- ================================== -->
    <!-- ENVIRONMENTAL AND THREAT SUMMARY -->
    <!-- ================================== -->

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

        <div class="metric-icon">🌱</div>

        <div>
          <p>Soil Moisture</p>

          <h2>
            {{
              latestReading?.soil_moisture_percent !== null &&
                latestReading?.soil_moisture_percent !== undefined
                ? formatNumber(latestReading.soil_moisture_percent)
                : '—'
            }}

            <span v-if="
              latestReading?.soil_moisture_percent !== null &&
              latestReading?.soil_moisture_percent !== undefined
            ">
              %
            </span>
          </h2>

          <small>
            {{
              latestReading
                ? 'Latest sensor reading'
                : 'No reading available'
            }}
          </small>
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

    </section>

    <!-- ================================== -->
    <!-- MONITORING HISTORY -->
    <!-- ================================== -->

    <MonitoringHistory />

    <!-- ================================== -->
    <!-- THREAT DETECTION RULES -->
    <!-- ================================== -->

    <ThreatDetectionRules />

    <!-- ================================== -->
    <!-- LATEST SENSOR READING -->
    <!-- ================================== -->

    <section class="panel">

      <div class="section-heading">

        <div>
          <h2>Latest Sensor Reading</h2>

          <p>
            Most recent environmental measurement received.
          </p>
        </div>

      </div>

      <div v-if="latestReading" class="reading-details">

        <div>
          <span>Plant ID</span>
          <strong>{{ latestReading.plant_id }}</strong>
        </div>

        <div>
          <span>Tracking Assignment ID</span>

          <strong>
            {{ latestReading.tracking_assignment_id ?? '—' }}
          </strong>
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
          <span>Soil Moisture Raw</span>

          <strong>
            {{ latestReading.soil_moisture_raw ?? '—' }}
          </strong>
        </div>

        <div>
          <span>Soil Moisture Percentage</span>

          <strong>
            {{ formatSoilMoisture(latestReading.soil_moisture_percent) }}
          </strong>
        </div>

        <div>
          <span>Recorded At</span>

          <strong>
            {{ formatDate(latestReading.recorded_at) }}
          </strong>
        </div>

      </div>

      <div v-else class="empty">
        No sensor readings are available.
      </div>

    </section>

    <!-- ================================== -->
    <!-- THREAT ALERTS -->
    <!-- ================================== -->

    <section class="panel">

      <div class="section-heading">

        <div>
          <h2>Threat Alerts</h2>

          <p>
            Review alerts recorded by the monitoring system.
          </p>
        </div>

        <span class="result-count">
          {{ filteredAlerts.length }} result(s)
        </span>

      </div>

      <!-- SEARCH -->

      <div class="filters">

        <input v-model="searchQuery" type="search" placeholder="Search plant ID, assignment, threat or message..."
          aria-label="Search threat alerts">

      </div>

      <!-- ALERT TABLE -->

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Plant ID</th>
              <th>Tracking Assignment ID</th>
              <th>Threat Type</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>

            <tr v-for="alert in filteredAlerts" :key="alert.alert_id">

              <td>{{ alert.alert_id }}</td>

              <td>{{ alert.plant_id }}</td>

              <td>
                {{ alert.tracking_assignment_id ?? '—' }}
              </td>

              <td>{{ alert.alert_type }}</td>

              <td>{{ alert.message }}</td>

              <td>
                {{ formatDate(alert.created_at) }}
              </td>

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

    <!-- ================================== -->
    <!-- RECENT SENSOR READINGS -->
    <!-- ================================== -->

    <section class="panel">

      <div class="section-heading">

        <div>
          <h2>Recent Sensor Readings</h2>

          <p>
            Latest 10 readings received from the monitoring system.
          </p>
        </div>

        <span class="result-count">
          {{ readingsList.length }} total reading(s)
        </span>

      </div>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              <th>Reading ID</th>
              <th>Plant ID</th>
              <th>Assignment ID</th>
              <th>Temperature</th>
              <th>Humidity</th>
              <th>Soil Moisture Raw</th>
              <th>Soil Moisture %</th>
              <th>Recorded At</th>
            </tr>
          </thead>

          <tbody>

            <tr v-for="reading in recentReadings" :key="reading.reading_id">

              <td>{{ reading.reading_id }}</td>

              <td>{{ reading.plant_id }}</td>

              <td>
                {{ reading.tracking_assignment_id ?? '—' }}
              </td>

              <td>
                {{ formatNumber(reading.temperature) }} °C
              </td>

              <td>
                {{ formatNumber(reading.humidity) }} %
              </td>

              <td>
                {{ reading.soil_moisture_raw ?? '—' }}
              </td>

              <td>
                {{ formatSoilMoisture(reading.soil_moisture_percent) }}
              </td>

              <td>
                {{ formatDate(reading.recorded_at) }}
              </td>

            </tr>

            <tr v-if="!recentReadings.length">

              <td colspan="8" class="empty">
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
.monitoring-refresh {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 24px;
  width: 100%;
  margin-bottom: 20px;
  padding: 12px 16px;
  box-sizing: border-box;
  color: #456255;
  font-size: 14px;
}

.refresh-left,
.refresh-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.monitoring-refresh label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.monitoring-refresh input {
  width: auto;
  margin: 0;
  flex-shrink: 0;
}

.monitoring-refresh small {
  margin: 0;
}

@media (max-width: 900px) {
  .monitoring-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .monitoring-refresh {
    align-items: flex-start;
    flex-direction: column;
  }

  .refresh-right {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}

@media (max-width: 450px) {
  .monitoring-summary {
    grid-template-columns: 1fr;
  }
}
</style>
