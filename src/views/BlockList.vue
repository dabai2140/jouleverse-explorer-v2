<template>
  <div class="block-list">
    <div class="header">
      <h1>Jouleverse 区块浏览器</h1>
      <p class="subtitle">Chain ID: 3666 | RPC: https://rpc.jnsdao.com:8503</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <span class="stat-label">最新区块高度</span>
        <span class="stat-value" v-if="latestBlockNumber !== null">
          {{ latestBlockNumber }}
        </span>
        <span class="stat-value loading" v-else>加载中...</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">网络状态</span>
        <span class="stat-value" :class="{ success: isConnected, error: !isConnected }">
          {{ isConnected ? '已连接' : '未连接' }}
        </span>
      </div>
    </div>

    <div class="blocks-section">
      <div class="section-header">
        <h2>最新区块</h2>
        <button @click="refreshBlocks" class="refresh-btn" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>

      <div class="loading" v-if="loading">加载区块数据中...</div>

      <div class="blocks" v-else-if="blocks.length > 0">
        <div v-for="(block, index) in blocks" :key="index" class="block-card">
          <div class="block-header">
            <div class="block-number">
              <span class="label">区块 #</span>
              <span class="value">{{ block.number }}</span>
            </div>
            <div class="block-age">
              <span class="value">{{ formatAge(block.timestamp) }}</span>
            </div>
          </div>

          <div class="block-details">
            <div class="detail-row">
              <span class="label">区块哈希</span>
              <span class="value hash">{{ formatHash(block.hash) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">交易数</span>
              <span class="value">{{ block.transactions.length }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Gas 使用</span>
              <span class="value">{{ formatNumber(block.gasUsed) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">矿工</span>
              <span class="value hash">{{ formatHash(block.miner) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="empty" v-else>
        <p>暂无区块数据</p>
        <button @click="refreshBlocks" class="btn-primary">加载区块</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatUnits } from 'viem'
import { publicClient } from '../config/client'

interface Block {
  number: bigint
  hash: string
  timestamp: bigint
  transactions: any[]
  gasUsed: bigint
  miner: string
}

const blocks = ref<Block[]>([])
const latestBlockNumber = ref<bigint | null>(null)
const loading = ref(false)
const isConnected = ref(false)
const lastBlockTime = ref<number>(Date.now())

const formatAge = (timestamp: bigint): string => {
  const blockTime = Number(timestamp) * 1000
  const now = Date.now()
  const diff = Math.floor((now - blockTime) / 1000)
  
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

const formatHash = (hash: string): string => {
  if (!hash) return ''
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
}

const formatNumber = (num: bigint): string => {
  return formatUnits(num, 0)
}

const refreshBlocks = async () => {
  loading.value = true
  try {
    // Get latest block number
    const blockNumber = await publicClient.getBlockNumber()
    latestBlockNumber.value = blockNumber
    isConnected.value = true

    // Get last 10 blocks
    const newBlocks: Block[] = []
    for (let i = 0; i < 10; i++) {
      const block = await publicClient.getBlock({
        blockNumber: blockNumber - BigInt(i),
      })
      newBlocks.push({
        number: block.number,
        hash: block.hash || '',
        timestamp: block.timestamp,
        transactions: block.transactions,
        gasUsed: block.gasUsed,
        miner: block.miner,
      })
    }

    blocks.value = newBlocks
    lastBlockTime.value = Date.now()
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
    isConnected.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshBlocks()
  
  // Auto refresh every 15 seconds
  setInterval(refreshBlocks, 15000)
})
</script>

<style scoped>
.block-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2.5rem;
  color: #1e293b;
  margin: 0 0 10px 0;
}

.subtitle {
  color: #64748b;
  font-size: 0.9rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-label {
  display: block;
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.stat-value {
  display: block;
  font-size: 1.与其他rem;
  font-weight: 600;
  color: #1e293b;
}

.stat-value.loading {
  color: #64748b;
}

.stat-value.success {
  color: #10b981;
}

.stat-value.error {
  color: #ef4444;
}

.blocks-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1e293b;
}

.refresh-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.refresh-btn:hover:not(:disabled) {
  background: #2563eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
}

.blocks {
  display: flex;
  flex-direction: column;
}

.block-card {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.block-card:last-child {
  border-bottom: none;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.block-number .label {
  color: #64748b;
  font-size: 0.9rem;
}

.block-number .value {
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 600;
  margin-left: 4px;
}

.block-age .value {
  color: #64748b;
  font-size: 0.9rem;
}

.block-details {
  display: grid;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row .label {
  color: #64748b;
  font-size: 0.9rem;
}

.detail-row .value {
  color: #1e293b;
  font-size: 0.9rem;
}

.detail-row .value.hash {
  font-family: 'Courier New', monospace;
  color: #3b82f6;
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
