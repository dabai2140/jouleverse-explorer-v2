<template>
  <div class="home">
    <div class="header">
      <h1>Jouleverse Explorer</h1>
      <NetworkStatus />
    </div>
    
    <div class="content">
      <h2>最新区块</h2>
      
      <div v-if="loading" class="loading">
        加载中...
      </div>
      
      <div v-else-if="blocks.length === 0" class="empty">
        暂无区块数据
      </div>
      
      <div v-else class="block-list">
        <BlockCard
          v-for="block in blocks"
          :key="block.number"
          :block="block"
          @click="handleBlockClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBlockchain } from '@/composables/useBlockchain';
import NetworkStatus from '@/components/NetworkStatus.vue';
import BlockCard from '@/components/BlockCard.vue';
import type { Block } from '@/types/block';

const { fetchLatestBlocks } = useBlockchain();

const blocks = ref<Block[]>([]);
const loading = ref(false);

const loadBlocks = async () => {
  loading.value = true;
  try {
    blocks.value = await fetchLatestBlocks(10);
  } catch (error) {
    console.error('Failed to load blocks:', error);
  } finally {
    loading.value = false;
  }
};

const handleBlockClick = (blockNumber: number) => {
  console.log('Clicked block:', blockNumber);
  // TODO: 导航到区块详情页
};

onMounted(() => {
  loadBlocks();
});
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #f3f4f6;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}

.content h2 {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.loading,
.empty {
  background: white;
  padding: 48px;
  border-radius: 8px;
  text-align: center;
  color: #6b7280;
}

.block-list {
  display: grid;
  gap: 16px;
}
</style>
