<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { species, saveSpecies } from '../services/speciesService'
import { statuses } from '../data/mockSpecies'
const route = useRoute(), router = useRouter()
const existing = species.value.find(r => r.id === route.params.id)
const missing = route.params.id && !existing
const form = reactive(existing ? { ...existing } : { commonName:'', scientificName:'', family:'', genus:'', status:'Not Evaluated', habitat:'', description:'', ecologicalNotes:'', culturalNotes:'', photo:'', photoName:'' })
const initial = JSON.stringify(form), error = ref(''), photoError = ref(''), reading = ref(false)
let saved = false
onBeforeRouteLeave(to => to.meta.authLayout || saved || initial === JSON.stringify(form) || window.confirm('Discard your unsaved changes?'))
async function choosePhoto(event) {
 const file = event.target.files[0]; photoError.value = ''
 if (!file) return
 if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 1024 * 1024) { photoError.value = 'Choose a JPG, PNG or WebP image up to 1 MB.'; event.target.value = ''; return }
 reading.value = true
 try { const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) }); await new Promise((resolve,reject) => { const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = data }); form.photo = data; form.photoName = file.name }
 catch { photoError.value = 'This image could not be read. Choose another file.' }
 finally { reading.value = false; event.target.value = '' }
}
function submit() { error.value = ''; try { const record = saveSpecies(form); saved = true; router.push(`/species/${record.id}`) } catch(e) { error.value = e.message } }
</script>
<template><RouterLink class="back" to="/species">← Back to species</RouterLink><section v-if="missing" class="empty"><h1>Species not found</h1><p>The record may have been deleted.</p></section><template v-else><div class="page-heading"><div><p class="eyebrow">SPECIES COLLECTION</p><h1>{{ existing ? 'Edit species' : 'Add species' }}</h1><p>Record the details that help others understand this species.</p></div><span class="muted">* Required fields</span></div><form @submit.prevent="submit"><div class="detail-grid"><section class="panel detail-content"><h2>Taxonomy & identification</h2><div class="form-grid"><label>Common name *<input v-model="form.commonName" required maxlength="120" autocomplete="off"></label><label>Scientific name *<input v-model="form.scientificName" required maxlength="160" placeholder="e.g. Genus species" autocomplete="off"></label><label>Family *<input v-model="form.family" required maxlength="100"></label><label>Genus<input v-model="form.genus" maxlength="100"></label><label>Conservation status *<select v-model="form.status"><option v-for="s in statuses" :key="s">{{ s }}</option></select></label><label>Habitat<input v-model="form.habitat" maxlength="200"></label></div><h2>Description & supporting information</h2><label>Description *<textarea v-model="form.description" required rows="4" maxlength="5000" placeholder="Describe the species and its identifying characteristics."></textarea></label><label>Ecological information<textarea v-model="form.ecologicalNotes" rows="3" maxlength="5000"></textarea></label><label>Cultural significance<textarea v-model="form.culturalNotes" rows="3" maxlength="5000"></textarea></label></section><section class="panel detail-content photo-panel"><h2>Species photograph</h2><img v-if="form.photo" class="species-photo" :src="form.photo" alt="Selected species photograph preview"><div v-else class="photo-empty">Add a reference photograph</div><label class="upload-label">Choose photograph<input type="file" accept="image/jpeg,image/png,image/webp" :disabled="reading" @change="choosePhoto"></label><p class="muted">JPG, PNG or WebP · Maximum 1 MB<br>Preview and browser storage only.</p><p v-if="form.photoName" class="filename">{{ form.photoName }}</p><button v-if="form.photo" type="button" class="button subtle" :disabled="reading" @click="form.photo=''; form.photoName=''">Remove photograph</button><p v-if="photoError" class="error" role="alert">{{ photoError }}</p></section></div><p v-if="error" role="alert" class="error">{{ error }}</p><div class="form-actions"><RouterLink class="button" to="/species">Cancel</RouterLink><button class="button primary" :disabled="reading" type="submit">{{ reading ? 'Reading photograph…' : 'Save species' }}</button></div></form></template></template>
