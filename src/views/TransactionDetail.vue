<template>
  <div class="tx-detail">
    <div class="header">
      <button class="back-btn" @click="goBack">← 返回</button>
      <h1>交易详情</h1>
    </div>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="tx" class="content">
      <div class="info-section">
        <h2>交易信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">交易哈希</span>
            <span class="value hash">{{ tx.hash }}</span>
          </div>
          <div class="info-item">
            <span class="label">区块高度</span>
            <span class="value">{{ tx.blockNumber }}</span>
          </div>
          <div class="info-item">
            <span class="label">区块哈希</span>
            <span class="value hash">{{ tx.blockHash }}</span>
          </div>
          <div class="info-item">
            <span class="label">交易索引</span>
            <span class="value">{{ tx.transactionIndex }}</span>
          </div>
          <div class="info-item">
            <span class="label">发送方</span>
            <span class="value address">{{ tx.from }}</span>
          </div>
          <div class="info-item">
            <span class="label">接收方</span>
            <span class="value address">{{ tx.to || '合约创建' }}</span>
          </div>
          <div class="info-item">
            <span class="label">数值</span>
            <span class="value">{{ formattedValue }}</span>
          </div>
          <div class="info-item">
            <span class="label">Gas</span>
            <span class="value">{{ Number(tx.gas).toLocaleString() }}</span>
          </div>
          <div class="info-item" v-if="tx.gasUsed">
            <span class="label">Gas Used</span>
            <span class="value">{{ Number(tx.gasUsed).toLocaleString() }}</span>
          </div>
          <div class="info-item" v-if="tx.gasPrice">
            <span class="label">Gas Price</span>
            <span class="value">{{ formatWei(tx.gasPrice) }} Gwei</span>
          </div>
          <div class="info-item">
            <span class="label">Nonce</span>
            <span class="value">{{ tx.nonce }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <span class="value status" :class="tx.status">{{ statusText }}</span>
          </div>
        </div>
      </div>

      <div class="input-section" v-if="tx.input && tx.input !== '0x'">
        <h2>Input Data</h2>
        <div class="input-content">
          {{ tx.input }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createPublicClient, http, formatUnits } from 'viem';
import type { TransactionDetail } from '@/types/transaction';

const route = useRoute();
const router = useRouter();

const txHash = ref<string>(route.params.hash as string);
const tx = ref<TransactionDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const client = createPublicClient({
  transport: http('https://rpc.jnsdao.com:8503'),
});

const loadTransaction = async () => {
  loading.value = true;
  error.value = null;

  try {
    const txData = await client.getTransaction({
      hash: txHash.value as `0x${string}`,
    });

    if (!txData) {
      error.value = '交易不存在';
      return;
    }

    const receipt = await client.getTransactionReceipt({
      hash: txHash.value as `0x${string}`,
    });

    tx.value = {
      hash: txData.hash,
      blockNumber: Number(txData.blockNumber),
      blockHash: txData.blockHash,
      transactionIndex: txData.transactionIndex,
      from: txData.from,
      to: txData.to,
      value: txData.value.toString(),
      gas: Number(txData.gas),
      gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
      gasPrice: txData.gasPrice ? txData.gasPrice.toString() : undefined,
      nonce: txData.nonce,
      input: txData.input,
      status: receipt?.status ? (receipt.status === 'success' ? 'success' : 'failed') : 'pending',
    };
  } catch (err) {
    console.error('Failed to load transaction:', err);
    error.value = '加载交易失败';
  } finally {
    loading.value = false;
  }
};

const formattedValue = computed(() => {
  if (!tx.value) return '';
  try {
    const value = formatUnits(BigInt(tx.value.value), 18);
    return `${value} J`;
  } catch {
    return `${tx.value.value} wei`;
  }
});

const statusText = computed(() => {
  if (!tx.value) return '';
  switch (tx.value.status) {
    case 'success':
      return '✅ 成功';
    case 'failed':
      return '❌ 失败';
    case 'pending':
      return '⏳ 等待中';
    default:
      return '未知';
  }
});

const formatWei = (wei: string): string => {
  try {
    const value = formatUnits(BigInt(wei), 9);
    return value;
  } catch {
    return wei;
  }
};

const goBack = () => {
  router.push('/');
};

onMounted(() => {
  loadTransaction();
});
</script>

<style scoped>
.tx-detail {
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
.input-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-section h2,
.input-section h2 {
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
  word-break: break-all;
}

.info-item .value.hash,
.info-item .value.address {
  font-family: monospace;
  color: #3b82f6;
}

.info-item .value.status {
  font-weight: 600;
}

.info-item .value.status.success {
  color: #10b981;
}

.info-item .value.status.failed {
  color: #ef4444}

.info-item .value.status.pending {
  color: #f59e0b;
}

.input-content {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  color: #374151;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}
</style>
