<script setup>
import { ref } from 'vue'
defineProps(
  { modelValue: String, id: String, label: String, 
    autocomplete: { type: String, 
    default: 'current-password' }, 
    minlength: { type: Number, default: 1 } 
  })

defineEmits(['update:modelValue'])
const visible = ref(false)
</script>

<template>
  <div class="password-field">
    <label :for="id">{{ label }}</label>
    <div class="password-control">
      <input :id="id" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"
        :type="visible ? 'text' : 'password'" :autocomplete="autocomplete" :minlength="minlength" maxlength="128"
        required>
      <button type="button" :aria-label="`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`" :aria-pressed="visible"
        :aria-controls="id" @click="visible = !visible">{{ visible ? 'Hide' : 'Show' }}</button>
    </div>
  </div>
</template>
