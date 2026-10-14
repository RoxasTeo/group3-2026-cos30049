<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../services/authService'
import AuthLayout from '../components/AuthLayout.vue'
import PasswordField from '../components/PasswordField.vue'
const email = ref(''), password = ref(''), feedback = ref('')
const busy = ref(false), route = useRoute(), router = useRouter()
async function submit() {
  if (busy.value) return
  feedback.value = ''; busy.value = true
  try {
    if (new TextEncoder().encode(password.value).length > 72) throw new Error('Password must not exceed 72 bytes.')
    const user = await login(email.value, password.value)
    const destination = typeof route.query.redirect === 'string' && /^\/(?:species(?:\/[^?#]*)?)?$/.test(route.query.redirect) ? route.query.redirect : '/'
    await router.replace(user.role === 'conservation_officer' ? destination : '/access-denied')
  } catch (error) { feedback.value = error.message }
  finally { password.value = ''; busy.value = false }
}
</script>
<template><AuthLayout title="Welcome back" subtitle="Sign in to your conservation workspace.">
  <p v-if="route.query.reason === 'unavailable'" class="error" role="alert">Unable to check your session. Please try signing in again.</p>
  <p v-else-if="route.query.reason === 'expired'" class="auth-feedback" role="status">Your session has ended. Please sign in again.</p>
  <form class="auth-form" :aria-busy="busy" @submit.prevent="submit" @input="feedback = ''">
    <label for="login-email">Email address<input id="login-email" v-model.trim="email" type="email" autocomplete="username" required maxlength="254" placeholder="name@example.com"></label>
    <PasswordField id="login-password" v-model="password" label="Password" />
    <p v-if="feedback" class="error" role="alert">{{ feedback }}</p>
    <button class="button primary" :disabled="busy" type="submit">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
  </form>
  <p class="auth-switch">Need an account? <RouterLink to="/register">Account access</RouterLink></p>
</AuthLayout></template>
