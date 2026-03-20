<template>
  <div class="block-detail">
    <div class="header">
      <button class="back-btn" @click="goBack">← 返回</button>
      <h1>区块详情 #{{ blockNumber }}</h1>
    </div>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="block" class="content">
      <div class="info-section">
        <h2>基本信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">区块高度</span>
            <span class="value">{{ block.number }}</span>
          </div>
          <div class="info-item">
            <span class="label">区块哈希</span>
            <span class="value hash">{{ block.hash }}</span>
          </div>
          <div class="info-item">
            <span class="label">时间戳</span>
            <span class="value">{{ formattedTime }}</span>
          </div>
          <div class="info-item">
            <span class="label">交易数量</span>
            <span class="value">{{ block.transactionCount }}</span>
          </div>
          <div class="info-item">
            <span class="label">矿工地址</span>
            <span class="value address">{{ block.miner }}</span>
          </div>
          <div class="info-item" v-if="block.size">
            <span class="label">区块大小</span>
            <span class="value">{{ formatBytes(block.size) }}</span>
          </div>
          <div class="info-item" v-if="block.gasUsed">
            <span class="label">Gas Used</span>
            <span class="value">{{ Number(block.gasUsed).toLocaleString() }}</span>
          </div>
          <div class="info-item" v-if="block.gasLimit">
            <span class="label">Gas Limit</span>
            <span class="value">{{ Number(block.gasLimit).toLocaleString() }}</span>
          </div>
          <div class="info-item" v-if="block.parentHash">
            <span class="label">父区块哈希</span>
            <span class="value hash">{{ block.parentHash }}</span>
          </div>
        </div>
      </div>

      <div class="transactions-section" v-if="block.transactions">
        <h2>交易列表 ({{ block.transactions.length }})</h2>
        <div v-if="block.transactions.length === 0" class="empty">
          此区块无交易
        </div>
        <div v-else class="transaction-list">
          <div
            v-for="(tx, index) in block.transactions"
            :key="tx"
            class="transaction-item"
            @click="viewTransaction(tx)"
          >
            <div class="tx-index">{{ index + 1 }}</div>
            <div class="tx-hash">{{ truncateHash(tx) }}</div>
            <div class="tx-arrow">→</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createPublicClient, http } from 'viem';
import type { BlockInfo } from '@/types/block';

const route = useRoute();
const router = useRouter();

const blockNumber = ref<number>(Number(route.params.number));
const block = ref<BlockInfo | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const client = createPublicClient({
  transport: http('https://rpc.jnsdao.com:8503'),
});

const loadBlock = async () => {
  loading.value = true;
  error.value = null;

  try {
    const blockData = await client.getBlock({
      blockNumber: BigInt(blockNumber.value),
      includeTransactions: true,
    });

    if (!blockData) {
      error.value = '区块不存在';
      return;
    }

    block.value = {
      number: Number(blockData.number),
      hash: blockData.hash,
      timestamp: Number(blockData.timestamp),
      transactionCount: blockData.transactions.length,
      miner: blockData.miner,
      size: Number(blockData.size),
      gasUsed: blockData.gasUsed ? Number(blockData.gasUsed) : undefined,
      gasLimit: Number(blockData.gasLimit),
      parentHash: blockData.parentHash,
      transactions: blockData.transactions.map(tx => tx.hash),
      extraData: blockData.extraData,
      stateRoot: blockData.stateRoot,
      transactionsRoot: blockData.transactionsRoot,
      receiptsRoot: blockData.receiptsRoot,
      logsBloom: blockData.logsBloom,
      difficulty: blockData.difficulty ? blockData.difficulty.toString() : undefined,
    };
  } catch (err) {
    console.error('Failed to load block:', err);
    error.value = '加载区块失败';
  } finally {
    loading.value = false;
  }
};

const formattedTime = computed(() => {
  if (!block.value) return '';
  const date = new Date(block.value.timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const truncateHash = (hash: string): string => {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

const goBack = () => {
  router.push('/');
};

const viewTransaction = (txHash: string) => {
  router.push(`/tx/${txHash}`);
};

onMounted(() => {
  loadBlock();
});
</script>

<style scoped>
.block-detail {
  min-height: 100vh;
  background: #f3f4f6;
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.back-btn {
  padding: 8px 16px;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #e5e7eb;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.loading,
.error {
  background: white;
  padding: 48px;
  border-radius: 8px;
  text-align: center;
  color: #6b7280;
}

.error {
  color: #ef4444;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section,
.transactions-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-section h2,
.transactions-section h2 {
  margin: 0 0 20px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.info-item .label {
  font-size: 12px;
  color: #6b7280;
}

.info-item .value {
  font-size: 14px;
  color: #1f2937;
  word: break-all;
}

.info-item .value.hash,
.info-item .value.address {
  font-family: monospace;
  color: #3b82f6;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.transaction-item:hover {
  background: #eff6ff;
}

.tx-index {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.tx-hash {
  flex: 1;
  font-family: monospace;
  font-size: 14px;
  color: #3b82f6;
}

.tx-arrow {
  color: #9ca3af;
}
</style>
