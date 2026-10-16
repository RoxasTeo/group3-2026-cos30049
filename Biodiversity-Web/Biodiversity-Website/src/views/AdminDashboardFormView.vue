<script setup>
import { reactive, ref} from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { request } from '../services/authService'

const router = useRouter()
const error = ref('')
let saved = false

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'user'
})

const initial = JSON.stringify(form)

onBeforeRouteLeave(() => saved || initial === JSON.stringify(form) || window.confirm('Discard your unsaved changes?'))

async function submit() {
  error.value = ''
  try {
    await request('/api/add_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    saved = true
    router.push('/admin/users')
  } catch (err) {
    error.value = err.message || 'An error occurred while creating the user account.'
  }
}
</script>

<template>
  <RouterLink class="back" to="/admin/users">← Back to profile management</RouterLink>

  <div class="page-heading">
    <div>
      <p class="eyebrow">REGISTRATION MANAGER</p>
      <h1>Add new system account</h1>
      <p>Provision security keys and credentials for an incoming park user or staff profile sheet.</p>
    </div>
    <span class="muted">* Required fields</span>
  </div>

  <div v-if="error" class="alert error" role="alert">{{ error }}</div>

  <!-- Centered, padded layout form sheet mimicking your species template style layout -->
  <section class="panel form-panel-layout-sheet">
    <form @submit.prevent="submit" class="vertical-form">
      <label>Full User Name *
        <input v-model="form.name" type="text" required placeholder="e.g. John Doe" autocomplete="off">
      </label>

      <label>Email Address *
        <input v-model="form.email" type="email" required placeholder="e.g. john@example" autocomplete="off">
      </label>

      <label>Account Password *
        <input v-model="form.password" type="password" required placeholder="Minimum 12 characters" autocomplete="off">
      </label>

      <label>System Authorization Role *
        <select v-model="form.role">
          <option value="user">General User</option>
          <option value="conservation_officer">Conservation Officer</option>
          <option value="botanist">Field Botanist</option>
        </select>
      </label>

      <div class="form-actions">
        <RouterLink class="button" to="/admin/users">Cancel</RouterLink>
        <button type="submit" class="button primary">Create Account</button>
      </div>
    </form>
  </section>
</template>
