<script setup lang="ts">
import { AUDIENCE_URL } from '../lib/constants'
import QrCode from './QrCode.vue'

const url = AUDIENCE_URL || 'http://localhost:3030/audience/'
</script>

<template>
  <QrCode :url="url" :size="280" />
</template>
