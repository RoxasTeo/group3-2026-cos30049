<script setup>
import { computed } from 'vue'

const props = defineProps({
  speciesId: { type: [Number, String], required: true },
  commonName: { type: String, default: 'plant' }
})

// The QR code contains only the stable, read-only profile URL. The plant record
// itself remains in MySQL; no duplicate copy of the record is embedded in the QR.
const profileUrl = computed(() => {
  const baseUrl = `${window.location.origin}${window.location.pathname}`
  return `${baseUrl}#/species-dashboard/${encodeURIComponent(props.speciesId)}`
})

// QRServer renders the encoded profile URL as a PNG. Only the URL (not plant
// details or photographs) is sent to the QR image service.
const qrImageUrl = computed(() =>
  `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&data=${encodeURIComponent(profileUrl.value)}`
)
const downloadName = computed(() => {
  const safeName = props.commonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${safeName || 'plant'}-qr-code.png`
})
</script>

<template>
  <section class="plant-qr-code" aria-labelledby="plant-qr-title">
    <h2 id="plant-qr-title">Plant QR code</h2>
    <p class="muted">Scan this code to open the read-only plant profile.</p>
    <img
      class="plant-qr-image"
      :src="qrImageUrl"
      :alt="`QR code linking to the ${commonName} plant profile`"
      width="240"
      height="240"
      loading="lazy"
    >
    <p class="plant-qr-url"><a :href="profileUrl" target="_blank" rel="noopener noreferrer">Open plant profile</a></p>
    <p class="plant-qr-download">
      <a :href="qrImageUrl" target="_blank" rel="noopener noreferrer" :download="downloadName">
        Open QR image to save or print
      </a>
    </p>
  </section>
</template>

<style scoped>
.plant-qr-code {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
}

.plant-qr-code h2,
.plant-qr-code p {
  margin: 0;
}

.plant-qr-image {
  display: block;
  width: min(240px, 100%);
  height: auto;
  aspect-ratio: 1;
  padding: 0.5rem;
  border: 1px solid var(--border, #d9dee7);
  border-radius: 0.5rem;
  background: #fff;
}

.plant-qr-url,
.plant-qr-download {
  overflow-wrap: anywhere;
}
</style>
