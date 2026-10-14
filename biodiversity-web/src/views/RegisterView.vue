<script setup>
import AuthLayout from '../components/AuthLayout.vue'
</script>
<template><AuthLayout title="Request account access" subtitle="Accounts are created by your project administrator.">
  <p>Contact your administrator with your name and email address to request access. Your role will be assigned according to your responsibilities.</p>
  <p class="auth-switch">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
</AuthLayout></template>
