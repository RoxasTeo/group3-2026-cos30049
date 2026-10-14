<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import { logout } from '../services/authService'
const router = useRouter(), busy = ref(false), error = ref('')
async function leave() {
  busy.value = true; error.value = ''
  try { await logout(); await router.replace('/login') }
  catch (e) { error.value = e.message }
  finally { busy.value = false }
}
</script>
<template><AuthLayout title="Access restricted" subtitle="This workspace requires the Conservation Officer role.">
  <p>Contact your administrator if you need access, or sign out to use another account.</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <button class="button primary" :disabled="busy" @click="leave">{{ busy ? 'Signing out…' : 'Sign out' }}</button>
</AuthLayout></template>
