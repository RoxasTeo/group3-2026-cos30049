<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../services/authService'
import AuthLayout from '../components/AuthLayout.vue'
import PasswordField from '../components/PasswordField.vue'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const feedback = ref('')
const busy = ref(false)

async function submit() {
  if (busy.value) return
  feedback.value = '';
  busy.value = true

  if (!name.value.trim()) {
    feedback.value = 'Enter your full name.'
    busy.value = false
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    feedback.value = 'Invalid email address format.'
    busy.value = false
    return
  }
  if (password.value !== confirmation.value) {
    feedback.value = 'Passwords do not match. Enter the same password in both fields.'
    busy.value = false
    return
  }
  if (password.value.length < 12) {
    feedback.value = 'Password must be at least 12 characters long to satisfy security rules.'
    busy.value = false
    return
  }

  try {
      if (new TextEncoder().encode(password.value).length > 72) throw new Error('Password must not exceed 72 bytes.')
      await register(name.value, email.value, password.value)
      await router.replace({ path: '/login', query: { registered: '1' } })
  } catch (error) { feedback.value = error.message }
  finally { password.value = ''; confirmation.value = ''; busy.value = false }
}
</script>
<template>
  <AuthLayout title="Create an User Account" subtitle="Register your details to get started.">
    <form class="auth-form" @submit.prevent="submit" @input="feedback = ''">
      <label for="register-name">Full name<input id="register-name" v-model="name" autocomplete="name" required
          maxlength="120" placeholder="Your full name"></label>
      <label for="register-email">Email address<input id="register-email" v-model.trim="email" type="email"
          autocomplete="email" required maxlength="254" placeholder="name@example.com"></label>
      <PasswordField id="register-password" v-model="password" label="Password" autocomplete="new-password"
        :minlength="12" />
      <p class="password-hint">Use at least 12 characters. Passwords must not exceed 72 UTF-8 bytes.</p>
      <PasswordField id="register-confirmation" v-model="confirmation" label="Confirm password"
        autocomplete="new-password" :minlength="12" />
      <p v-if="feedback" class="error" role="alert">{{ feedback }}</p>

      <button class="button primary" type="submit" :disabled="busy">Register</button>

    </form>
    <p class="auth-switch">Already have an account? <RouterLink to="/login">Sign in</RouterLink>
    </p>
  </AuthLayout>
</template>
