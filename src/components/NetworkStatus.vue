<template>
  <div class="network-status" :class="{ online: isOnline, offline: !isOnline }">
    <div class="status-dot"></div>
    <span class="status-text">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useBlockchainStore } from '@/stores/blockchain';

const store = useBlockchainStore();

const isOnline = computed(() => store.networkStatus === 'online');
const statusText = computed(() => isOnline.value ? '🟢 数据正常' : '🔴 数据异常');
</script>

<style scoped>
.network-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.network-status.online {
  background-color: #d1fae5;
  color: #065f46;
}

.network-status.offline {
  background-color: #fee2e2;
  color: #991b1b;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.network-status.online .status-dot {
  background-color: #10b981;
}

.network-status.offline .status-dot {
  background-color: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
