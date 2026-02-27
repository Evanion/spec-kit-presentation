<script setup lang="ts">
defineProps<{
  type: 'waiting' | 'disconnected' | 'ended'
}>()

const messages: Record<string, string> = {
  waiting: "Presentation hasn't started yet",
  disconnected: 'Connection lost — reconnecting...',
  ended: 'Presentation has ended — thanks for joining!',
}
</script>

<template>
  <div class="status-message" :class="type" role="status" :aria-live="type === 'disconnected' ? 'assertive' : 'polite'">
    <div class="status-icon">
      <span v-if="type === 'waiting'">&#9203;</span>
      <span v-else-if="type === 'disconnected'">&#9888;</span>
      <span v-else>&#10004;</span>
    </div>
    <p class="status-text">{{ messages[type] }}</p>
  </div>
</template>

<style scoped>
.status-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px 24px;
  text-align: center;
  min-height: 200px;
}

.status-icon {
  font-size: 2.5rem;
}

.status-text {
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 1.1rem;
  color: #DADCF1;
  margin: 0;
}

.disconnected .status-text {
  color: #ffaa44;
}
</style>
