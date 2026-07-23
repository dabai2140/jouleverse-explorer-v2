<template>
  <div class="transaction-detail">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1 v-if="loading">加载交易中...</h1>
      <h1 v-else-if="transaction">交易详情</h1>
      <h1 v-else>交易未找到</h1>
    </div>

    <div v-if="transaction" class="transaction-info">
      <div class="info-section">
        <h2>交易信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">交易哈希</span>
            <JvHashText :value="transaction.hash" type="tx" :truncate="12" :linkable="false" />
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <JvStatusTag :status="transaction.status === 'success' ? 'tx-success' : 'tx-failed'" />
          </div>
          <div class="info-item">
            <span class="label">区块</span>
            <JvHashText :value="String(transaction.blockNumber)" type="block" :truncate="0" />
          </div>
          <div class="info-item">
            <span class="label">时间戳</span>
            <span class="value">{{ formatTimestamp(transaction.blockTimestamp) }}</span>
          </div>
          <div class="info-item">
            <span class="label">发送方</span>
            <JvHashText :value="transaction.from" type="address" :truncate="8" />
          </div>
          <div class="info-item">
            <span class="label">接收方</span>
            <JvHashText v-if="transaction.to" :value="transaction.to" type="address" :truncate="8" />
            <span v-else class="value">合约创建</span>
          </div>
          <div class="info-item">
            <span class="label">发送金额</span>
            <JvAmount :value="transaction.value" unit="J" />
          </div>
          <div class="info-item" v-if="transaction.gasPrice">
            <span class="label">Gas 价格</span>
            <JvAmount :value="transaction.gasPrice" :decimals="9" unit="Gwei" :maxDecimals="4" />
          </div>
          <div class="info-item">
            <span class="label">Gas 限制</span>
            <span class="value">{{ formatNumber(transaction.gas) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Gas 使用</span>
            <span class="value">{{ formatNumber(transaction.gasUsed || 0) }}</span>
          </div>
          <div class="info-item">
            <span class="label">随机数</span>
            <span class="value">{{ transaction.nonce }}</span>
          </div>
          <div class="info-item">
            <span class="label">输入数据</span>
            <span class="value mono">{{ formatInput(transaction.input) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="error-section">
      <JvPageState
        type="network-error"
        title="交易未找到"
        :description="`找不到交易: ${txHash}`"
        action="返回首页"
        @action="$router.push('/')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { publicClient } from '../config/client'
import { formatNumber } from '../utils/format'
import { JvHashText, JvStatusTag, JvAmount, JvPageState } from '../design-system'

interface Props {
  hash: string
}

const props = defineProps<Props>()

const transaction = ref<any>(null)
const loading = ref(true)
const txHash = ref(props.hash)

const formatTimestamp = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}


const formatInput = (input: string): string => {
  if (!input || input === '0x') return '无'
  if (input.length <= 50) return input
  return `${input.substring(0, 50)}...`
}

const loadTransaction = async () => {
  loading.value = true
  try {
    const [txData, receipt] = await Promise.all([
      publicClient.getTransaction({ hash: props.hash as `0x${string}` }),
      publicClient.getTransactionReceipt({ hash: props.hash as `0x${string}` }),
    ])
    const block = await publicClient.getBlock({ blockNumber: txData.blockNumber! })
    transaction.value = { ...txData, ...receipt, blockTimestamp: block.timestamp }
  } catch (error) {
    console.error('Failed to fetch transaction:', error)
    transaction.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadTransaction() })
</script>

<style scoped>
.transaction-detail {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header { margin-bottom: 30px; }

.back-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-muted);
  border: none;
  padding: 8px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  margin-bottom: 20px;
  display: inline-block;
  transition: background var(--jv-duration-fast) var(--jv-ease);
}
.back-btn:hover { background: var(--jv-bg-hover); }

.header h1 { color: var(--jv-text-primary); margin: 0; }

.transaction-info { display: flex; flex-direction: column; gap: 30px; }

.info-section {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px;
}

.info-section h2 {
  color: var(--jv-text-primary);
  margin: 0 0 20px 0;
  font-size: 1.25rem;
}

.info-grid { display: grid; gap: 16px; }

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--jv-bg-subtle);
  border-radius: var(--jv-radius-md);
}

.info-item .label {
  color: var(--jv-text-muted);
  font-size: 0.9rem;
  min-width: 200px;
}

.info-item .value {
  color: var(--jv-text-primary);
  font-size: 0.9rem;
  word-break: break-all;
  max-width: 70%;
}

.info-item .value.mono {
  font-family: var(--jv-font-mono);
  color: var(--jv-text-secondary);
}

.error-section {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 40px;
}
</style>
