<script setup lang="ts">
import { useSupabase } from '../composables/useSupabase'

const { connectionState, isAvailable } = useSupabase()
</script>

<template>
  <Transition name="connection-fade">
    <div
      v-if="isAvailable && connectionState === 'disconnected' || connectionState === 'reconnecting'"
      class="connection-status"
    >
      Connection lost — reconnecting...
    </div>
  </Transition>
</template>

<style scoped>
.connection-status {
  position: fixed;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(204, 51, 51, 0.9);
  color: #F8F8F8;
  padding: 6px 16px;
  border-radius: 0 0 6px 6px;
  font-family: 'Century Gothic', sans-serif;
  font-size: 0.75rem;
  z-index: 100;
}

.connection-fade-enter-active,
.connection-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.connection-fade-enter-from,
.connection-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>
