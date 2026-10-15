<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { request } from '../services/authService'
import { statuses } from '../data/mockSpecies'
const existing = computed(() => {
  return species.value?.find(r => 
    String(r.species_id ?? '') === String(route.params.id) || 
    String(r.id ?? '') === String(route.params.id)
  )
})
const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => !!route.params.id)
const missing = ref(false)
const loading = ref(isEditMode.value)
const error = ref('')
const photoError = ref('')
const reading = ref(false)
let saved = false

// Initialize a completely unified reactive state mapping form attributes cleanly
const form = reactive({
  common_name: '',
  scientific_name: '',
  family: '',
  genus: '',
  status: 'Not Evaluated',
  habitat: '',
  description: '',
  ecological_info: '',
  cultural_sign: '',
  photo: '',
  photo_name: ''
})

let initial = ''

onMounted(async () => {
  if (!isEditMode.value) {
    initial = JSON.stringify(form)
    return
  }
  
  try {
    const data = await request(`/api/get_species.php?id=${route.params.id}`)
    if (data) {
      // Dynamic fallback mapping check blocks ensures input fields prepopulate cleanly
      Object.assign(form, {
        common_name: data.common_name || data.commonName || '',
        scientific_name: data.scientific_name || data.scientificName || '',
        family: data.family || '',
        genus: data.genus || '',
        status: data.status || 'Not Evaluated',
        habitat: data.habitat || '',
        description: data.description || '',
        ecological_info: data.ecological_info || data.ecologicalNotes || '',
        cultural_sign: data.cultural_sign || data.culturalNotes || '',
        photo: data.photo || '',
        photo_name: data.photo_name || data.photoName || ''
      })
      initial = JSON.stringify(form)
    } else {
      missing.value = true
    }
  } catch (e) {
    error.value = e.message || 'Failed to fetch species records.'
    missing.value = true
  } finally {
    loading.value = false
  }
})

onBeforeRouteLeave(() => saved || initial === JSON.stringify(form) || window.confirm('Discard your unsaved changes?'))

async function choosePhoto(event) {
  const file = event.target.files[0]
  photoError.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { 
    photoError.value = 'Choose a JPG, PNG or WebP image up to 1 MB.'
    event.target.value = ''
    return 
  }
  reading.value = true
  try { 
    const data = await new Promise((resolve, reject) => { 
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file) 
    })
    form.photo = data
    form.photo_name = file.name 
  } catch { 
    photoError.value = 'This image could not be read. Choose another file.' 
  } finally { 
    reading.value = false
    event.target.value = '' 
  }
}

async function submit() { 
  error.value = ''
  try {
    const url = isEditMode.value 
      ? `/api/edit_species.php?id=${route.params.id}` 
      : '/api/add_species.php'

    const hybridPayload = {
      common_name: form.common_name,
      commonName: form.common_name,
      scientific_name: form.scientific_name,
      scientificName: form.scientific_name,
      family: form.family,
      genus: form.genus,
      status: form.status,
      habitat: form.habitat,
      description: form.description,
      ecological_info: form.ecological_info,
      ecologicalNotes: form.ecological_info,
      cultural_sign: form.cultural_sign,
      culturalNotes: form.cultural_sign,
      photo: form.photo,
      photo_name: form.photo_name,
      photoName: form.photo_name
    }

    await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hybridPayload)
    })
    
    saved = true
    router.push('/species') 
  } catch (e) { 
    error.value = e.message || 'An error occurred while saving the record.'
  } 
}
</script>

<template>
  <RouterLink class="back" to="/species">← Back to species</RouterLink>
  
  <div v-if="loading" class="panel alert info">Loading configuration metrics...</div>
  
  <section v-else-if="missing" class="empty">
    <h1>Species not found</h1>
    <p>The record may have been deleted.</p>
  </section>
  
  <template v-else>
    <div class="page-heading">
      <div>
        <p class="eyebrow">SPECIES COLLECTION</p>
        <h1>{{ isEditMode ? 'Edit species details' : 'Add new species' }}</h1>
        <p>Record the details that help others understand this species.</p>
      </div>
      <span class="muted">* Required fields</span>
    </div>
    
    <form @submit.prevent="submit">
      <div class="detail-grid">
        <section class="panel detail-content">
          <h2>Taxonomy & identification</h2>
          <div class="form-grid">
            <label>Common name *
              <input v-model="form.common_name" required maxlength="120" autocomplete="off">
            </label>
            <label>Scientific name *
              <input v-model="form.scientific_name" required maxlength="160" placeholder="e.g. Genus species" autocomplete="off">
            </label>
            <label>Family *
              <input v-model="form.family" required maxlength="100">
            </label>
            <label>Genus
              <input v-model="form.genus" maxlength="100">
            </label>
            <label>Conservation status *
              <select v-model="form.status">
                <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label>Habitat
              <input v-model="form.habitat" maxlength="200">
            </label>
          </div>
          
          <h2>Description & supporting information</h2>
          <label>Description *
            <textarea v-model="form.description" required rows="4" maxlength="5000" placeholder="Describe the species and its identifying characteristics."></textarea>
          </label>
          <label>Ecological information
            <textarea v-model="form.ecological_info" rows="3" maxlength="5000"></textarea>
          </label>
          <label>Cultural significance
            <textarea v-model="form.cultural_sign" rows="3" maxlength="5000"></textarea>
          </label>
        </section>
        
        <section class="panel detail-content photo-panel">
          <h2>Species photograph</h2>
          <img v-if="form.photo" class="species-photo" :src="form.photo" alt="Selected species photograph preview">
          <div v-else class="photo-empty">Add a reference photograph</div>
          
          <label class="upload-label">Choose photograph
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="reading" @change="choosePhoto">
          </label>
          <p class="muted">JPG, PNG or WebP · Maximum 1 MB<br>Saved directly into the primary system database.</p>
          
          <p v-if="form.photo_name" class="filename">{{ form.photo_name }}</p>
          
          <button v-if="form.photo" type="button" class="button subtle" :disabled="reading" @click="form.photo = ''; form.form.photo_name = ''">
            Remove photograph
          </button>
          <p v-if="photoError" class="error" role="alert">{{ photoError }}</p>
        </section>
      </div>
      
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      
      <div class="form-actions">
        <RouterLink class="button" to="/species">Cancel</RouterLink>
        <button class="button primary" :disabled="reading" type="submit">
          {{ reading ? 'Reading photograph…' : 'Save species' }}
        </button>
      </div>
    </form>
  </template>
</template>
