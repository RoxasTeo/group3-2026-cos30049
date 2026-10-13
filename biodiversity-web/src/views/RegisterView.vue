<script setup>
import { ref } from 'vue'
import AuthLayout from '../components/AuthLayout.vue'
import PasswordField from '../components/PasswordField.vue'
const name = ref(''), email = ref(''), password = ref(''), confirmation = ref(''), error = ref(''), feedback = ref('')
function clearFeedback() { error.value = ''; feedback.value = '' }
function submit() {
  clearFeedback()
  if (!name.value.trim()) { error.value = 'Enter your full name.'; return }
  if (password.value !== confirmation.value) { error.value = 'Passwords do not match. Enter the same password in both fields.'; return }
  // Never persist passwords or assign an officer role in frontend code.
  password.value = ''; confirmation.value = ''
  feedback.value = 'Your form is valid. Registration is not available until the backend is connected; no account has been created.'
}
</script>
<template><AuthLayout title="Create an account" subtitle="Register your details to get started.">
  <form class="auth-form" @submit.prevent="submit" @input="clearFeedback">
    <label for="register-name">Full name<input id="register-name" v-model="name" autocomplete="name" required maxlength="120" placeholder="Your full name"></label>
    <label for="register-email">Email address<input id="register-email" v-model.trim="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@example.com"></label>
    <PasswordField id="register-password" v-model="password" label="Password" autocomplete="new-password" :minlength="8" />
    <p class="password-hint">Use 8–128 characters. The final password policy will be set by your team.</p>
    <PasswordField id="register-confirmation" v-model="confirmation" label="Confirm password" autocomplete="new-password" :minlength="8" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="auth-feedback" role="status">{{ feedback }}</p>
    <button class="button primary" type="submit">Register</button>
  </form>
  <p class="auth-switch">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
</AuthLayout></template>
