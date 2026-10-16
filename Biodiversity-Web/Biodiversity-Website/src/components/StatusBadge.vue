<script setup>
defineProps({ status: String })
</script>

<template>
    <span class="badge"
          :class="{ danger: ['Endangered', 'Critically Endangered', 'Extinct', 'Extinct in the Wild'].includes(status), 
          amber: ['Vulnerable', 'Near Threatened'].includes(status) }">{{ status }}
    </span>
</template>
