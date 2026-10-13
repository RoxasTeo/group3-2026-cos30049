<script setup>
import { ref } from 'vue'
import AuthLayout from '../components/AuthLayout.vue'
import PasswordField from '../components/PasswordField.vue'
const email = ref(''), password = ref(''), feedback = ref('')
function submit() {
  // Backend team: replace this preview response with the authenticated API flow.
  password.value = ''
  feedback.value = 'Your form is valid, but sign-in is not available until the authentication backend is connected. No sign-in request was sent.'
}
</script>
<template><AuthLayout title="Welcome back" subtitle="Sign in to your conservation workspace.">
  <form class="auth-form" @submit.prevent="submit" @input="feedback = ''">
    <label for="login-email">Email address<input id="login-email" v-model.trim="email" type="email" autocomplete="username" required maxlength="254" placeholder="name@example.com"></label>
    <PasswordField id="login-password" v-model="password" label="Password" />
    <p v-if="feedback" class="auth-feedback" role="status">{{ feedback }}</p>
    <button class="button primary" type="submit">Sign in</button>
  </form>
  <p class="auth-switch">New to the workspace? <RouterLink to="/register">Register</RouterLink></p>
</AuthLayout></template>
