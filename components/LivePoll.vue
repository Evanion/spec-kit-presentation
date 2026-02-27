<script setup lang="ts">
defineProps<{
  question: string
  status?: string
}>()
</script>

<template>
  <div class="live-poll">
    <div class="live-poll-indicator" v-if="status !== 'closed'">
      <span class="live-dot" /> Voting is active
    </div>
    <div class="live-poll-indicator closed" v-else>
      Poll closed
    </div>
    <div class="live-poll-question">{{ question }}</div>
    <div class="live-poll-note">Vote on your phone!</div>
  </div>
</template>

<style scoped>
.live-poll {
  padding: 8px 0;
}

.live-poll-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #4CAF50;
  margin-bottom: 8px;
}

.live-poll-indicator.closed {
  color: #DADCF1;
  opacity: 0.6;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4CAF50;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.live-poll-question {
  font-size: 1rem;
  color: #3FCDFA;
  font-weight: 700;
}

.live-poll-note {
  font-size: 0.8rem;
  color: #DADCF1;
  opacity: 0.7;
  margin-top: 4px;
}
</style>
