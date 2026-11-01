<script setup>
import { ref, computed, onMounted } from 'vue'
import { request } from '../services/authService'

const readingsList = ref([])
const alertsList = ref([])
const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const alertTypeFilter = ref('all')

async function fetchMonitoringData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [readingsData, alertsData] = await Promise.all([
      request('/api/get_sensor_readings.php'),
      request('/api/get_threat_alerts.php')
    ])

    // Match the response structure from the PHP GET APIs.
    readingsList.value = Array.isArray(readingsData?.readings)
      ? readingsData.readings
      : []

    alertsList.value = Array.isArray(alertsData?.alerts)
      ? alertsData.alerts
      : []
  } catch (error) {
    console.error('Failed to load monitoring data:', error)
    errorMessage.value =
      'Unable to load monitoring data. Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchMonitoringData)

// Sort newest readings first.
function sortByDate(items, dateField) {
  return [...items].sort(
    (a, b) =>
      new Date(String(b[dateField] ?? '').replace(' ', 'T')).getTime() -
      new Date(String(a[dateField] ?? '').replace(' ', 'T')).getTime()
  )
}

// Latest sensor reading.
const latestReading = computed(() => {
  const sorted = sortByDate(readingsList.value, 'recorded_at')
  return sorted[0] ?? null
})

// Recent sensor history.
const recentReadings = computed(() =>
  sortByDate(readingsList.value, 'recorded_at').slice(0, 10)
)

// Alert summary.
const totalAlerts = computed(() => alertsList.value.length)

const alertTypeCounts = computed(() => {
  const counts = {}

  for (const alert of alertsList.value) {
    const type = alert.alert_type || 'Unknown'
    counts[type] = (counts[type] || 0) + 1
  }

  return counts
})

const alertTypes = computed(() =>
  Object.keys(alertTypeCounts.value).sort()
)

// Filter threat alerts by search text and alert type.
const filteredAlerts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return sortByDate(alertsList.value, 'created_at').filter(alert => {
    const matchesType =
      alertTypeFilter.value === 'all' ||
      alert.alert_type === alertTypeFilter.value

    const searchableText = [
      alert.species_id,
      alert.common_name,
      alert.scientific_name,
      alert.alert_type,
      alert.message
    ]
      .map(value => String(value ?? ''))
      .join(' ')
      .toLowerCase()

    return matchesType && searchableText.includes(query)
  })
})

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

function displaySpecies(readingOrAlert) {
  return (
    readingOrAlert.common_name ||
    `Species ID: ${readingOrAlert.species_id ?? '—'}`
  )
}
</script>

<template>
  <div class="monitoring-dashboard">
    <!-- Page heading -->
    <div class="page-heading">
      <div>
        <p class="eyebrow">NIAH BIODIVERSITY SYSTEM</p>
        <h1>Centralized Monitoring Dashboard</h1>
        <p>
          Monitor environmental readings and review detected threats.
        </p>
      </div>

      <button class="button primary" :disabled="loading" @click="fetchMonitoringData">
        {{ loading ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>

    <!-- Error message -->
    <div v-if="errorMessage" class="alert error">
      {{ errorMessage }}
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
        <div class="metric-icon">🌱</div>
        <div>
          <p>Soil Moisture</p>
          <h2>
            {{ formatNumber(latestReading?.soil_moisture_percent) }}
            <span>%</span>
          </h2>
          <small>Latest calibrated reading</small>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon">⚠️</div>
        <div>
          <p>Total Threat Alerts</p>
          <h2>{{ totalAlerts }}</h2>
          <small>Recorded alerts</small>
        </div>
      </article>
    </section>

    <!-- Threat overview -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Threat Overview</h2>
          <p>Recorded alerts grouped by threat type.</p>
        </div>
      </div>

      <div v-if="alertTypes.length" class="threat-overview">
        <div v-for="type in alertTypes" :key="type" class="threat-overview-item">
          <span class="status-pill">{{ type }}</span>
          <strong>{{ alertTypeCounts[type] }}</strong>
        </div>
      </div>

      <div v-else class="empty">
        No threat alerts have been recorded.
      </div>
    </section>

    <!-- Latest sensor reading -->
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
          <span>Common Name</span>
          <strong>{{ latestReading.common_name || '—' }}</strong>
        </div>

        <div>
          <span>Scientific Name</span>
          <strong>{{ latestReading.scientific_name || '—' }}</strong>
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
          <span>Soil Moisture (Raw)</span>
          <strong>
            {{ latestReading.soil_moisture_raw ?? '—' }}
          </strong>
        </div>

        <div>
          <span>Soil Moisture (%)</span>
          <strong>
            {{ formatNumber(latestReading.soil_moisture_percent) }}
            %
          </strong>
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
        <input v-model="searchQuery" type="search" placeholder="Search species, threat or message..."
          aria-label="Search threat alerts" />

        <select v-model="alertTypeFilter" aria-label="Filter by threat type">
          <option value="all">All Threat Types</option>
          <option v-for="type in alertTypes" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Species</th>
              <th>Scientific Name</th>
              <th>Threat Type</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="alert in filteredAlerts" :key="alert.alert_id">
              <td>
                {{ displaySpecies(alert) }}
                <small>
                  (ID: {{ alert.species_id }})
                </small>
              </td>

              <td>{{ alert.scientific_name || '—' }}</td>
              <td>
                <span class="status-pill">
                  {{ alert.alert_type }}
                </span>
              </td>
              <td>{{ alert.message }}</td>
              <td>{{ formatDate(alert.created_at) }}</td>
            </tr>

            <tr v-if="!filteredAlerts.length">
              <td colspan="5" class="empty">
                No matching threat alerts found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Recent sensor readings -->
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Recent Sensor Readings</h2>
          <p>Latest 10 environmental readings received.</p>
        </div>

        <span class="result-count">
          {{ readingsList.length }} total reading(s)
        </span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Species</th>
              <th>Temperature</th>
              <th>Humidity</th>
              <th>Soil Moisture (Raw)</th>
              <th>Soil Moisture (%)</th>
              <th>Recorded At</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="reading in recentReadings" :key="reading.reading_id">
              <td>
                {{ displaySpecies(reading) }}
                <small>
                  (ID: {{ reading.species_id }})
                </small>
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
                {{ formatNumber(reading.soil_moisture_percent) }}
                {{ reading.soil_moisture_percent == null ? '' : '%' }}
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