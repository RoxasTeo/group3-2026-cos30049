<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../services/authService'
import StatusBadge from '../components/StatusBadge.vue'
import PlantQrCode from '../components/PlantQrCode.vue'

const route = useRoute()
const router = useRouter()
const dialog = ref(null)
const error = ref('')
const loading = ref(true)
const record = ref(null)

onMounted(async () => {
  try {
    const data = await request(`/api/get_species.php?id=${route.params.id}`)
    record.value = data
  } catch (e) {
    error.value = e.message || 'Failed to retrieve record profiles.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
    <RouterLink class="back" to="/species-dashboard">← Back to species</RouterLink>
    
    <div v-if="loading" class="panel alert info">Loading species profile metrics...</div>
    
    <template v-else-if="record">
        <div class="page-heading">
            <div>
                <p class="eyebrow">SPECIES PROFILE</p>
                <h1>{{ record.common_name }}</h1>
                <p><i>{{ record.scientific_name }}</i></p>
            </div>
        </div>
        
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        
        <div class="detail-grid">
            <section class="panel detail-content">
                <h2>Species information</h2>
                <dl>
                    <div>
                        <dt>Scientific name</dt>
                        <dd><i>{{ record.scientific_name }}</i></dd>
                    </div>
                    <div>
                        <dt>Family</dt>
                        <dd>{{ record.family }}</dd>
                    </div>
                    <div>
                        <dt>Genus</dt>
                        <dd>{{ record.genus || 'Not recorded' }}</dd>
                    </div>
                    <div>
                        <dt>Conservation status</dt>
                        <dd>
                            <StatusBadge :status="record.status" />
                        </dd>
                    </div>
                    <div>
                        <dt>Habitat</dt>
                        <dd>{{ record.habitat || 'Not recorded' }}</dd>
                    </div>
                </dl>
                
                <h2>Description</h2>
                <p class="prose">{{ record.description }}</p>
                
                <h2>Ecological information</h2>
                <p class="prose">{{ record.ecological_info || 'Not recorded' }}</p>
                
                <h2>Cultural significance</h2>
                <p class="prose">{{ record.cultural_sign || 'Not recorded' }}</p>
            </section>
            
            <section class="panel detail-content">
                <h2>Species photograph</h2>
                <img v-if="record.photo" class="species-photo" :src="record.photo" :alt="record.common_name">
                <div v-else class="photo-empty">No photograph added</div>
                
                <p class="muted" v-if="record.updated_at">
                    Last updated {{ new Date(record.updated_at).toLocaleDateString('en-GB') }}
                </p>
                <PlantQrCode :species-id="record.species_id" :common-name="record.common_name" />
            </section>
        </div>
        
        <dialog ref="dialog" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete {{ record.common_name }}?</h2>
            <p>This removes the record permanently from the database. This action cannot be undone.</p>
            <div class="actions">
                <button class="button" autofocus @click="dialog.close()">Cancel</button>
                <button class="button danger-button" @click="remove">Delete record</button>
            </div>
        </dialog>
    </template>
    
    <section v-else class="empty">
        <h1>Species not found</h1>
        <p>The record may have been deleted or doesn't exist.</p>
    </section>
</template>

