<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { request } from '../services/authService'
const config = ref(null), error = ref('')
const controller = new AbortController()
let mounted = true
onMounted(async () => {
  const timeout = setTimeout(() => controller.abort(), 15000)
  try { const result = await request('/api/get_threat_rules.php', { signal: controller.signal }); if (mounted) config.value = result.configuration }
  catch { if (mounted) error.value = 'Detection rules could not be loaded. Refresh the page to retry.' }
  finally { clearTimeout(timeout) }
})
onBeforeUnmount(() => { mounted = false; controller.abort() })
</script>
<template>
  <section class="panel detection-rules" aria-labelledby="detection-title">
    <div class="rules-heading"><div><p class="eyebrow">PLANT PROTECTION</p><h2 id="detection-title">Automatic threat detection</h2></div><span v-if="config" class="status-pill">{{ config.enabled ? 'Enabled' : 'Paused' }}</span></div>
    <p>Incoming sensor readings are checked automatically. New alerts appear in Threat Alerts on the next dashboard refresh.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="!config">Loading detection rules…</p>
    <template v-else>
      <p v-if="!config.enabled" class="rules-note">Automatic detection is paused. Readings are still recorded.</p>
      <details><summary>View current thresholds</summary><div class="table-scroll"><table><thead><tr><th>Measurement</th><th>Warning</th><th>Critical</th></tr></thead><tbody>
        <tr><td>Temperature</td><td>≤ {{ config.temperature_low_warning }} or ≥ {{ config.temperature_high_warning }} °C</td><td>≤ {{ config.temperature_low_critical }} or ≥ {{ config.temperature_high_critical }} °C</td></tr>
        <tr><td>Humidity</td><td>≤ {{ config.humidity_low_warning }} or ≥ {{ config.humidity_high_warning }} %</td><td>≤ {{ config.humidity_low_critical }} or ≥ {{ config.humidity_high_critical }} %</td></tr>
        <tr><td>Proximity distance</td><td>≤ {{ config.proximity_warning_cm }} cm</td><td>≤ {{ config.proximity_critical_cm }} cm</td></tr>
        <tr><td>Distance change</td><td>≥ {{ config.distance_change_warning_cm }} cm</td><td>≥ {{ config.distance_change_critical_cm }} cm</td></tr>
      </tbody></table></div></details>
      <p class="rules-note">Distance change compares consecutive readings no more than {{ config.baseline_max_age_seconds }} seconds apart. The same rule is limited to one alert per monitoring stream within {{ config.cooldown_seconds }} seconds; escalation to Critical is immediate.</p>
      <p class="rules-note">These are initial thresholds awaiting field calibration. A distance change suggests unusual activity or sensor movement; it does not confirm poaching.</p>
    </template>
  </section>
</template>
<style scoped>
.detection-rules { padding: 24px; color: #203C33; }
.rules-heading { display:flex;align-items:center;justify-content:space-between;gap:16px; }
.status-pill { background:#EAF0E1;color:#34664B; }
p { line-height:1.6; }.rules-note { color:#64756C;font-size:13px; }
summary { cursor:pointer;color:#1B5E4B;padding:8px 0; }
@media(max-width:500px) { .detection-rules { padding:16px; } }
</style>
