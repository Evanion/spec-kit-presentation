<script setup lang="ts">
import { onMounted } from 'vue'
import { usePresenterAuth } from './composables/usePresenterAuth'
import { useSession } from './composables/useSession'
import { useSlideSync } from './composables/useSlideSync'
import ConnectionStatus from './components/ConnectionStatus.vue'

const { isPresenter } = usePresenterAuth()
const { initSession } = useSession()
const { watchPresenterNav } = useSlideSync()

onMounted(async () => {
  if (isPresenter.value) {
    await initSession()
    // Watch slide navigation and broadcast changes
    // $nav is injected by Slidev; access via useNav if available
    try {
      const { useNav } = await import('@slidev/client')
      const nav = useNav()
      watchPresenterNav(nav.currentPage)
    } catch {
      // Not in Slidev context (shouldn't happen in presenter view)
    }
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
