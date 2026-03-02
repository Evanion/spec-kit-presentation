<script setup lang="ts">
import QrCode from './QrCode.vue'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 280 })
const url = `${window.location.origin}/audience/`
</script>

<template>
  <QrCode :url="url" :size="props.size" />
</template>
