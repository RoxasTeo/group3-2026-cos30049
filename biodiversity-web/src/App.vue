<script setup>
import { storageWarning } from './services/speciesService'
</script>
<template>
  <a class="skip" href="#main">Skip to content</a>
  <aside class="sidebar">
    <div class="brand"><span class="brandmark">N</span><div>NIAH<span>BIODIVERSITY SYSTEM</span></div></div>
    <div class="nav-label">CONSERVATION WORKSPACE</div>
    <nav aria-label="Main navigation"><RouterLink to="/" :class="{ selected: $route.path === '/' }"><span aria-hidden="true">▦</span> Overview</RouterLink><RouterLink to="/species" :class="{ selected: $route.path.startsWith('/species') }"><span aria-hidden="true">▤</span> Species management</RouterLink></nav>
    <div class="park"><span class="eyebrow">PROTECTED AREA</span><strong>Niah National Park</strong><span>Sarawak, Malaysia</span></div>
    <div class="profile"><span class="avatar">CO</span><div>Conservation Officer<small>Demo workspace</small></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><span>Plant knowledge system</span><span class="demo-pill">Sprint 1 · Demo</span></header>
    <main id="main" tabindex="-1"><div class="demo-note">Sample data · Changes are saved in this browser only. Species names and assessments are fictional.</div><p v-if="storageWarning" class="error" role="alert">{{ storageWarning }}</p><RouterView :key="$route.fullPath" /></main>
    <footer>Niah biodiversity workspace <span>Conservation Officer · Sprint 1 prototype</span></footer>
  </div>
</template>
