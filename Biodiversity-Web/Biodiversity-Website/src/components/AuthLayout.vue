<script setup>
defineProps({ title: String, subtitle: String })
</script>
<template>
  <div class="auth-page">
    <section class="auth-intro" aria-label="Niah biodiversity system">
      <div class="brand"><span class="brandmark">N</span><div>NIAH<span>BIODIVERSITY SYSTEM</span></div></div>
      <div><p class="eyebrow">CONSERVATION WORKSPACE</p><h1>Knowledge that supports conservation.</h1><p>Document plant diversity and maintain the species collection for Niah National Park.</p></div>
      <p class="auth-location">Niah National Park · Sarawak, Malaysia</p>
    </section>
    <main class="auth-main" id="main" tabindex="-1">
      <div class="auth-card"><span class="demo-pill">Frontend preview</span><h2>{{ title }}</h2><p>{{ subtitle }}</p>
        <div class="demo-note">Authentication is not connected yet. Use test details only; these forms do not create accounts or sign you in.</div>
        <slot />
        <div class="auth-demo"><RouterLink to="/">Explore demo workspace</RouterLink><p>No account needed for the sample-data dashboard.</p></div>
      </div>
    </main>
  </div>
</template>
