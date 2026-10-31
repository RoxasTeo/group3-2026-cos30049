<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { distributionReturn } from '../services/distributionNavigation.js'
import { currentUser } from '../services/authService'
import { decisionError, getObservation, photoSource, reviewDate, reviewObservation } from '../services/observationService'
import '../observation-review.css'

const route = useRoute(), router = useRouter()
const mapReturn = computed(() => distributionReturn(route.query.returnTo))
const backTarget = computed(() => mapReturn.value || '/observations')
function linkedSpecies(id) { return { path: `/species/${id}`, query: mapReturn.value ? { returnTo: route.query.returnTo } : {} } }
const record = ref(null), loading = ref(true), busy = ref(false), error = ref(''), success = ref('')
const notes = ref(''), checks = ref({ notes: false, photos: false, gps: false })
const decision = ref(''), confirmation = ref(null), imageDialog = ref(null), activePhoto = ref(null)
const feedback = ref(null)
let accessRedirect = false
let mounted = true
const own = computed(() => record.value?.submitted_by === Number(currentUser.value?.id))
const canReview = computed(() => record.value?.status === 'Pending' && !own.value)
const dirty = computed(() => canReview.value && (notes.value !== '' || Object.values(checks.value).some(Boolean)))
function handleAccess(e) {
  if (e.status === 401) { accessRedirect = true; record.value = null; router.replace({ path: '/login', query: { redirect: route.fullPath } }); return true }
  if (e.status === 403) { accessRedirect = true; record.value = null; router.replace('/access-denied'); return true }
  return false
}
async function load() {
  if (busy.value || (dirty.value && !window.confirm('Discard your unsaved reviewer notes and reload?'))) return
  loading.value = true; error.value = ''; success.value = ''
  try {
    const result = await getObservation(route.params.id)
    if (mounted) { record.value = result; notes.value = ''; checks.value = { notes: false, photos: false, gps: false } }
  } catch (e) { if (mounted) { record.value = null; if (!handleAccess(e)) error.value = e.message || 'Unable to load the observation.' } }
  finally { if (mounted) loading.value = false }
}
async function prepare(value) {
  error.value = ''; success.value = ''
  const issue = decisionError(value, notes.value, checks.value)
  if (issue) { error.value = issue; await nextTick(); feedback.value?.focus(); return }
  decision.value = value
  await nextTick(); if (!confirmation.value.open) confirmation.value.showModal()
}
async function confirm() {
  if (busy.value || !canReview.value) return
  busy.value = true; error.value = ''
  try {
    const result = await reviewObservation(record.value, decision.value, notes.value, checks.value)
    if (mounted) { record.value = result; notes.value = ''; checks.value = { notes: false, photos: false, gps: false }; success.value = 'Review decision saved.' }
  } catch (e) { if (mounted && !handleAccess(e)) error.value = e.status === 409 ? 'Another review changed this observation. Reload the observation before continuing. Your notes are kept until you reload.' : e.message || 'Unable to save the review. Your notes are kept; retry after checking the observation.' }
  finally { if (mounted) { busy.value = false; confirmation.value?.close(); if (error.value) { await nextTick(); feedback.value?.focus() } } }
}
async function preview(photo) { activePhoto.value = photo; await nextTick(); imageDialog.value.showModal() }
function beforeUnload(event) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(() => accessRedirect || (busy.value ? false : !dirty.value || window.confirm('Discard your unsaved reviewer notes?')))
onMounted(() => { load(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { mounted = false; window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <div class="observation-page">
    <RouterLink class="back" :to="backTarget">← {{ mapReturn ? 'Back to species distribution' : 'Back to observations' }}</RouterLink>
    <p v-if="loading" role="status">Loading observation…</p>
    <p v-if="error" ref="feedback" class="error observation-feedback" role="alert" tabindex="-1">{{ error }}</p>
    <p v-if="success" class="observation-success" role="status">{{ success }}</p>
    <button v-if="!loading" class="button observation-reload" :disabled="busy" @click="load">Reload observation</button>
    <template v-if="record && !loading">
      <div class="page-heading"><div><p class="eyebrow">{{ record.reference }} · {{ record.plant_tag }}</p><h1>{{ record.common_name }}</h1><p>Submitted by {{ record.submitter_name }} · {{ reviewDate(record.submitted_at) }}</p></div><span class="observation-status" :data-status="record.status">{{ record.status }}</span></div>
      <div class="observation-detail-grid"><div>
        <section class="panel"><h2>Submitted plant information</h2><dl class="observation-facts">
          <div><dt>Proposed scientific name</dt><dd><i>{{ record.scientific_name || 'Identification pending' }}</i></dd></div><div><dt>Family</dt><dd>{{ record.family || 'Not identified' }}</dd></div>
          <div><dt>Height</dt><dd>{{ record.height_m == null ? 'Not recorded' : `${record.height_m} m` }}</dd></div><div><dt>Linked species</dt><dd v-if="record.species_id"><RouterLink :to="linkedSpecies(record.species_id)">Species #{{ record.species_id }}</RouterLink></dd><dd v-else>Not linked to a species record</dd></div>
        </dl><h3>Field observations</h3><p class="observation-prose">{{ record.field_notes }}</p><h3>Habitat</h3><p class="observation-prose">{{ record.habitat || 'Not recorded' }}</p><p class="observation-notice">Submitted identification is provisional. Accepting field evidence does not confirm taxonomy or change conservation status.</p></section>
        <section class="panel"><h2>Review history</h2><div class="observation-history"><strong>Submitted</strong><p>{{ record.submitter_name }} · {{ reviewDate(record.submitted_at) }}</p></div><div v-for="review in record.reviews" :key="review.id" class="observation-history"><strong>{{ review.decision }}</strong><p>{{ review.reviewer_name }} · {{ reviewDate(review.created_at) }}</p><p class="observation-prose">{{ review.notes || 'No additional reviewer notes.' }}</p><small>Evidence checks: notes {{ review.checks.notes ? 'reviewed' : 'not checked' }} · photos {{ review.checks.photos ? 'reviewed' : 'not checked' }} · GPS {{ review.checks.gps ? 'reviewed' : 'not checked' }}</small></div></section>
      </div><div>
        <section class="panel"><h2>Photographic evidence ({{ record.photos.length }})</h2><div v-if="record.photos.length" class="observation-photos"><button v-for="(photo, index) in record.photos" :key="index" class="observation-photo" :disabled="!photoSource(photo)" @click="preview(photo)"><img v-if="photoSource(photo)" :src="photoSource(photo)" :alt="photo.caption || `Submitted plant photograph ${index + 1}`"><span v-else>Image unavailable</span><span>{{ photo.caption || photo.file_name || `Photograph ${index + 1}` }}</span><small>View full photograph</small></button></div><p v-else>No photographs submitted.</p></section>
        <section class="panel"><h2>GPS evidence</h2><dl class="observation-facts"><div><dt>Latitude</dt><dd>{{ record.latitude ?? 'Not recorded' }}</dd></div><div><dt>Longitude</dt><dd>{{ record.longitude ?? 'Not recorded' }}</dd></div><div><dt>Accuracy</dt><dd>{{ record.accuracy_m == null ? 'Not supplied' : `±${record.accuracy_m} m` }}</dd></div><div><dt>Captured</dt><dd>{{ reviewDate(record.location_captured_at) }}</dd></div></dl><p class="observation-hint">Location supplied by the botanist; verify its accuracy before approving.</p></section>
      </div></div>
      <section v-if="canReview" class="panel"><h2>Review decision</h2><fieldset class="observation-checks" :disabled="busy"><legend class="observation-sr">Evidence review checklist</legend><label><input v-model="checks.notes" type="checkbox">I have reviewed the field notes and proposed identification.</label><label><input v-model="checks.photos" type="checkbox">I have checked the photographs and any missing evidence.</label><label><input v-model="checks.gps" type="checkbox">I have checked the GPS location and accuracy.</label><label class="observation-notes">Reviewer notes<textarea v-model="notes" rows="4" maxlength="1000" placeholder="Add findings or explain what needs to be corrected…"></textarea></label></fieldset><p class="observation-hint">Notes are required when requesting changes or rejecting a submission.</p><div class="actions"><button class="button primary" :disabled="busy" @click="prepare('Approved')">Approve observation</button><button class="button" :disabled="busy" @click="prepare('Changes requested')">Request changes</button><button class="button danger-button" :disabled="busy" @click="prepare('Rejected')">Reject submission</button></div></section>
      <section v-else class="panel"><h2>{{ own ? 'Independent review required' : 'Decision recorded' }}</h2><p>{{ own ? 'You cannot review your own submission. Another conservation officer or administrator must review it.' : 'This observation is read-only. Submitted evidence and review history are retained.' }}</p></section>
    </template>
    <dialog ref="confirmation" aria-labelledby="observation-confirm-title" @cancel="busy && $event.preventDefault()"><h2 id="observation-confirm-title">{{ decision === 'Approved' ? 'Approve this observation?' : decision === 'Rejected' ? 'Reject this submission?' : 'Return for changes?' }}</h2><p v-if="decision === 'Approved'">The observation will be marked Approved. The species knowledge record remains unchanged.</p><p v-else-if="decision === 'Rejected'">The submission will be marked Rejected. Its evidence and review history will be retained.</p><p v-else>Your feedback will be saved for the botanist. Mobile feedback display and resubmission will be connected separately.</p><p class="observation-prose">{{ notes || 'No additional reviewer notes.' }}</p><div class="actions"><button class="button" autofocus :disabled="busy" @click="confirmation.close()">Keep reviewing</button><button class="button primary" :disabled="busy" @click="confirm">{{ busy ? 'Saving…' : decision === 'Approved' ? 'Confirm approval' : decision === 'Rejected' ? 'Confirm rejection' : 'Confirm request' }}</button></div></dialog>
    <dialog ref="imageDialog" aria-labelledby="observation-photo-title"><h2 id="observation-photo-title">Photograph preview</h2><img v-if="activePhoto && photoSource(activePhoto)" class="observation-full-photo" :src="photoSource(activePhoto)" :alt="activePhoto.caption || 'Submitted plant photograph'"><p>{{ activePhoto?.caption || activePhoto?.file_name }}</p><button class="button" autofocus @click="imageDialog.close()">Close preview</button></dialog>
  </div>
</template>
