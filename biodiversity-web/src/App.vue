<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storageWarning } from './services/speciesService'
import { currentUser, logout, refreshSession, clearIdentity } from './services/authService'
const route = useRoute(), router = useRouter(), busy = ref(false), error = ref(''), checking = ref(false)
function expired() {
  clearIdentity()
  if (route.meta.requiresAuth) router.replace({ path: '/login', query: { reason: 'expired' } })
}
async function recheck() {
  if (!route.meta.requiresAuth || checking.value) return
  checking.value = true
  try {
    const user = await refreshSession()
    if (!user) expired()
    else if (user.role !== 'conservation_officer') await router.replace('/access-denied')
  } catch { error.value = 'Unable to verify your session. Try again before continuing.' }
  finally { checking.value = false }
}
async function signOut() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await logout(); await router.replace('/login') }
  catch (e) { error.value = e.message }
  finally { busy.value = false }
}
onMounted(() => { window.addEventListener('session-expired', expired); window.addEventListener('access-changed', recheck); window.addEventListener('focus', recheck) })
onUnmounted(() => { window.removeEventListener('session-expired', expired); window.removeEventListener('access-changed', recheck); window.removeEventListener('focus', recheck) })
</script>
<template>
  <a class="skip" href="#main">Skip to content</a>
  <RouterView v-if="$route.meta.authLayout" :key="$route.fullPath" />
  <template v-else>
  <aside class="sidebar">
    <div class="brand"><span class="brandmark">N</span><div>NIAH<span>BIODIVERSITY SYSTEM</span></div></div>
    <div class="nav-label">CONSERVATION WORKSPACE</div>
    <nav aria-label="Main navigation"><RouterLink to="/" :class="{ selected: $route.path === '/' }"><span aria-hidden="true">▦</span> Overview</RouterLink><RouterLink to="/species" :class="{ selected: $route.path.startsWith('/species') }"><span aria-hidden="true">▤</span> Species management</RouterLink></nav>
    <div class="park"><span class="eyebrow">PROTECTED AREA</span><strong>Niah National Park</strong><span>Sarawak, Malaysia</span></div>
    <div class="profile"><span class="avatar">CO</span><div>{{ currentUser?.name }}<small>Conservation Officer</small></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><span>Plant knowledge system</span><div class="auth-header-links"><span>{{ currentUser?.name }}</span><button class="button" :disabled="busy" @click="signOut">{{ busy ? 'Signing out…' : 'Sign out' }}</button></div></header>
    <main id="main" tabindex="-1"><div class="demo-note">Sample data · Changes are saved in this browser only. Species names and assessments are fictional.</div><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="storageWarning" class="error" role="alert">{{ storageWarning }}</p><RouterView :key="$route.fullPath" /></main>
    <footer>Niah biodiversity workspace <span>Conservation Officer · Sprint 1 prototype</span></footer>
  </div>
  </template>
</template>
