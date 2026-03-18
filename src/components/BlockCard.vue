<template>
  <div class="block-card" @click="handleClick">
    <div class="block-number">#{{ block.number }}</div>
    <div class="block-info">
      <div class="info-row">
        <span class="label">哈希:</span>
        <span class="value hash">{{ truncatedHash }}</span>
      </div>
      <div class="info-row">
        <span class="label">时间:</span>
        <span class="value">{{ formattedTime }}</span>
      </div>
      <div class="info-row">
        <span class="label">交易数:</span>
        <span class="value">{{ block.transactionCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Block } from '@/types/block';

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  click: [blockNumber: number];
}>();

const truncatedHash = computed(() => {
  return `${props.block.hash.slice(0, 10)}...${props.block.hash.slice(-8)}`;
});

const formattedTime = computed(() => {
  const date = new Date(props.block.timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
});

const handleClick = () => {
  emit('click', props.block.number);
};
</script>

<style scoped>
.block-card {
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.block-number {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.block-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.label {
  color: #6b7280;
  min-width: 60px;
}

.value {
  color: #374151;
}

.hash {
  font-family: monospace;
  color: #3b82f6;
}
</style>
