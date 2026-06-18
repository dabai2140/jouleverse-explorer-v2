<template>
  <div class="block-detail">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1 v-if="loading">加载区块 {{ blockNumber }} 中...</h1>
      <h1 v-else-if="block">区块 #{{ block.number }}</h1>
      <h1 v-else>区块 #{{ blockNumber }} 未找到</h1>
    </div>

    <div v-if="block" class="block-info">
      <div class="info-section">
        <h2>区块信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">区块号</span>
            <span class="value">{{ block.number }}</span>
          </div>
          <div class="info-item">
            <span class="label">区块哈希</span>
            <span class="value hash">{{ block.hash }}</span>
          </div>
          <div class="info-item">
            <span class="label">父区块哈希</span>
            <span class="value hash">{{ block.parentHash }}</span>
          </div>
          <div class="info-item">
            <span class="label">时间戳</span>
            <span class="value">{{ formatTimestamp(block.timestamp) }}</span>
          </div>
          <div class="info-item">
            <span class="label">矿工</span>
            <span class="value hash" @click="$router.push(`/address/${block.miner}`)">{{ block.miner }}</span>
          </div>
          <div class="info-item">
            <span class="label">Gas 限制</span>
            <span class="value">{{ formatNumber(block.gasLimit) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Gas 使用</span>
            <span class="value">{{ formatNumber(block.gasUsed) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Gas 使用率</span>
            <span class="value">{{ calculateGasUsed(block.gasUsed, block.gasLimit) }}%</span>
          </div>
          <div class="info-item">
            <span class="label">交易数</span>
            <span class="value">{{ block.transactions.length }}</span>
          </div>
          <div class="info-item">
            <span class="label">难度</span>
            <span class="value">{{ block.difficulty.toString() }}</span>
          </div>
          <div class="info-item">
            <span class="label">随机数</span>
            <span class="value">{{ block.nonce }}</span>
          </div>
          <div class="info-item">
            <span class="label">大小</span>
            <span class="value">{{ block.size }} bytes</span>
          </div>
        </div>
      </div>

      <div class="transactions-section" v-if="block.transactions.length > 0">
        <h2>交易列表 ({{ block.transactions.length }})</h2>
        <div class="transactions-list">
          <div
            v-for="(tx, index) in block.transactions"
            :key="index"
            class="transaction-item"
            @click="viewTransaction(tx)"
          >
            <div class="tx-header">
              <span class="tx-index">#{{ index }}</span>
              <span class="tx-hash">{{ formatHash(tx) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="empty-section" v-else>
        <p>此区块没有交易</p>
      </div>
    </div>

    <div v-else-if="!loading" class="error">
      <p>未找到区块 #{{ blockNumber }}</p>
      <button @click="$router.push('/')" class="btn-primary">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatUnits } from 'viem'
import { publicClient } from '../config/client'

interface Props {
  number: string
}

const props = defineProps<Props>()

const block = ref<any>(null)
const loading = ref(true)
const blockNumber = ref(props.number)

const formatTimestamp = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const formatHash = (hash: string): string => {
  if (!hash) return ''
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
}

const formatNumber = (num: bigint): string => {
  return formatUnits(num, 0)
}

const calculateGasUsed = (used: bigint, limit: bigint): number => {
  const usedNum = Number(used)
  const limitNum = Number(limit)
  return Math.round((usedNum / limitNum) * 100)
}

const viewTransaction = (txHash: string) => {
  window.location.href = `/tx/${txHash}`
}

const loadBlock = async () => {
  loading.value = true
  try {
    const blockNum = BigInt(props.number)
    const blockData = await publicClient.getBlock({
      blockNumber: blockNum,
      includeTransactions: true,
    })
    block.value = blockData
  } catch (error) {
    console.error('Failed to fetch block:', error)
    block.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadBlock()
})
</script>

<style scoped>
.block-detail {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 30px;
}

.back-btn {
  background: #f1f5f9;
  color: #64748b;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 20px;
  display: inline-block;
}

.back-btn:hover {
  background: #e2e8f0;
}

.header h1 {
  color: #1e293b;
  margin: 0;
}

.block-info {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.info-section, .transactions-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
}

.info-section h2, .transactions-section h2 {
  color: #1e293b;
  margin: 0 0 20px 0;
  font-size: 1.25rem;
}

.info-grid {
  display: grid;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.info-item .label {
  color: #64748b;
  font-size: 0.9rem;
  min-width: 200px;
}

.info-item .value {
  color: #1e293b;
  font-size: 0.9rem;
  word-break: break-all;
  max-width: 70%;
}

.info-item .value.hash {
  font-family: 'Courier New', monospace;
  color: #3b82f6;
  cursor: pointer;
}

.info-item .value.hash:hover {
  text-decoration: underline;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.transaction-item:hover {
  background: #e2e8f0;
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tx-index {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 600;
}

.tx-hash {
  font-family: 'Courier New', monospace;
  color: #3b82f6;
  font-size: 0.9rem;
}

.empty-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #64748b;
}

.error {
  text-align: center;
  padding: 60px 20px;
  color: #ef4444;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 20px;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>
