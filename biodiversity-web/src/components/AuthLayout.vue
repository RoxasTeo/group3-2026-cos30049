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
      <div class="auth-card"><span class="demo-pill">Conservation Officer portal</span><h2>{{ title }}</h2><p>{{ subtitle }}</p>
        <slot />
      </div>
    </main>
  </div>
</template>
