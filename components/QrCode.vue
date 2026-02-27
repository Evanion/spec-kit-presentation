<script setup lang="ts">
import { computed } from 'vue'
import QRCode from 'qrcode-svg'

const props = withDefaults(defineProps<{
  url: string
  size?: number
  color?: string
  background?: string
}>(), {
  size: 256,
  color: '#DADCF1',
  background: 'transparent',
})

const svgContent = computed(() => {
  const qr = new QRCode({
    content: props.url,
    width: props.size,
    height: props.size,
    color: props.color,
    background: props.background,
    container: 'svg-viewbox',
    join: true,
    ecl: 'M',
  })
  return qr.svg()
})
</script>

<template>
  <div class="qr-code" v-html="svgContent" />
</template>

<style scoped>
.qr-code {
  display: inline-block;
  line-height: 0;
}

.qr-code :deep(svg) {
  width: 100%;
  height: auto;
  max-width: v-bind('`${size}px`');
}
</style>
