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
    if (!user) {
      expired()
    } else {
      const allowedRoles = ['user', 'conservation_officer', 'admin']
      if (!allowedRoles.includes(user.role)) {
        await router.replace('/access-denied')
      }
    }
  } catch {
    error.value = 'Unable to verify your session. Try again before continuing.'
  } finally {
    checking.value = false
  }
}
async function signOut() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await logout(); await router.replace('/login') }
  catch (e) { error.value = e.message }
  finally { busy.value = false }
}
function hasAccess(linkPath) {
  const role = currentUser.value?.role
  if (role === 'admin') return true
  if (linkPath === '/' || linkPath.startsWith('/species')) {
    return role === 'conservation_officer'
  }
  if (linkPath.startsWith('/species-dashboard')) {
    return role === 'user' || role === 'botanist'
  } 
  return false
}

function handleNavigation(e, linkPath) {
  if (!hasAccess(linkPath)) {
    e.preventDefault()
    error.value = 'Access Denied: Your account role does not have authorization to view this workspace section.'
    setTimeout(() => { error.value = '' }, 5000)
  }
}
onMounted(() => {
  window.addEventListener('session-expired', expired);
  window.addEventListener('access-changed', recheck);
  window.addEventListener('focus', recheck)
})

onUnmounted(() => {
  window.removeEventListener('session-expired', expired);
  window.removeEventListener('access-changed', recheck);
  window.removeEventListener('focus', recheck)
})
</script>
vue
<template>
  <a class="skip" href="#main">Skip to content</a>
  <RouterView v-if="$route.meta.authLayout" :key="$route.fullPath" />
  <template v-else>
    <aside class="sidebar">
      <div class="brand"><span class="brandmark">N</span>
        <div>NIAH<span>BIODIVERSITY SYSTEM</span></div>
      </div>

      <div class="nav-label">
        <template v-if="currentUser?.role === 'admin'">ADMINISTRATOR SYSTEM</template>
        <template v-else-if="currentUser?.role === 'conservation_officer'">CONSERVATION WORKSPACE</template>
        <template v-else>EXPLORER PLATFORM</template>
      </div>

      <nav aria-label="Main navigation">
        <RouterLink to="/" :class="{ selected: $route.path === '/', locked: !hasAccess('/') }"
          @click="handleNavigation($event, '/')">
          <span aria-hidden="true">▦</span> Overview
        </RouterLink>

        <RouterLink to="/species-dashboard"
          :class="{ selected: $route.path.startsWith('/species-dashboard'), locked: !hasAccess('/species-dashboard') }"
          @click="handleNavigation($event, '/species-dashboard')">
          <span aria-hidden="true">▤</span> Species database
        </RouterLink>

        <RouterLink to="/species"
          :class="{ selected: $route.path === '/species' || $route.path.startsWith('/species/'), locked: !hasAccess('/species') }"
          @click="handleNavigation($event, '/species')">
          <span aria-hidden="true">▤</span> Species management
        </RouterLink>

      </nav>

      <div class="park">
        <span class="eyebrow">PROTECTED AREA</span>
        <strong>Niah National Park</strong>
        <span>Sarawak, Malaysia</span>
      </div>

      <!-- Dynamic Profile Avatar Badge -->
      <component :is="currentUser?.role === 'admin' ? 'RouterLink' : 'div'" to="/admin/users"
        :class="['profile', { 'admin-clickable': currentUser?.role === 'admin' }]"
        :title="currentUser?.role === 'admin' ? 'Open Admin Dashboard' : ''">
        <!-- Left Side: Avatar Initials Badge -->
        <span class="avatar">
          {{ currentUser?.role === 'admin' ? 'AD' : (currentUser?.role === 'conservation_officer' ? 'CO' : 'UR') }}
        </span>


        <div>
          {{ currentUser?.name }}
          <small>
            {{ currentUser?.role === 'admin' ? 'Administrator' : (currentUser?.role === 'conservation_officer' ?
              'Conservation Officer' : 'General User') }}
          </small>
        </div>
      </component>
    </aside>

    <div class="workspace">
      <header class="topbar"><span>Plant knowledge system</span>
        <div class="auth-header-links"><span>{{ currentUser?.name }}</span><button class="button" :disabled="busy"
            @click="signOut">{{ busy ? 'Signing out…' : 'Sign out' }}</button></div>
      </header>
      <main id="main" tabindex="-1">
        <div class="demo-note">Sample data · Changes are saved in this browser only. Species names and assessments are
          fictional.</div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="storageWarning" class="error" role="alert">{{ storageWarning }}</p>
        <RouterView :key="$route.fullPath" />
      </main>
      <footer>
        Niah biodiversity workspace <span>Sprint 1 prototype</span>
      </footer>
    </div>
  </template>
</template>