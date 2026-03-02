<script setup lang="ts">
import { inject, onMounted, computed, watch } from 'vue'
import { usePresenterAuth } from './composables/usePresenterAuth'
import { useSession } from './composables/useSession'
import { useSlideSync } from './composables/useSlideSync'
import ConnectionStatus from './components/ConnectionStatus.vue'
import type { PollConfig } from './lib/types'

const { isPresenter } = usePresenterAuth()
const { initSession } = useSession()
const { syncSlide } = useSlideSync()

const slidevContext = inject('$$slidev-context') as {
  nav: {
    currentSlideNo: number
    slides: Array<{ no: number; meta: { slide: { frontmatter: Record<string, any> } } }>
  }
} | undefined
const currentPage = computed(() => slidevContext?.nav?.currentSlideNo ?? 1)

// Extract poll configs from slide frontmatter — no hardcoded slide numbers needed
function getPollConfigs(): PollConfig[] {
  const slides = slidevContext?.nav?.slides
  if (!slides) return []
  return slides
    .filter(s => s.meta?.slide?.frontmatter?.poll)
    .map(s => ({
      slideNumber: s.no,
      question: s.meta.slide.frontmatter.poll as string,
      options: s.meta.slide.frontmatter.pollOptions as string[],
    }))
}

onMounted(async () => {
  if (isPresenter.value) {
    await initSession(getPollConfigs())
    // Watch slide navigation and broadcast changes via Slidev context injection
    watch(currentPage, (page) => {
      syncSlide(page)
    })
  }
})
</script>

<template>
  <div class="regent-header">
    <img src="/images/regent-logo.svg" alt="Regent" class="regent-header-logo" />
  </div>
  <ConnectionStatus v-if="isPresenter" />
</template>

<style>
.regent-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background-color: #272833;
  border-bottom: 2px solid #0099CC;
  z-index: 10;
}

.regent-header-logo {
  height: 22px;
  width: auto;
}
</style>
