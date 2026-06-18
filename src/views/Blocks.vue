<template>
  <div class="blocks">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1>区块列表</h1>
    </div>

    <div class="controls">
      <div class="search-box">
        <input
          v-model="searchBlockNumber"
          @keyup.enter="goToBlock"
          placeholder="输入区块号..."
          class="search-input"
        >
        <button @click="goToBlock" class="search-btn">跳转</button>
      </div>
      <button @click="refreshBlocks" class="refresh-btn" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div class="loading" v-if="loading">加载区块数据中...</div>

    <div class="blocks-list" v-else-if="blocks.length > 0">
      <div v-for="(block, index) in blocks" :key="index" class="block-card" @click="$router.push(`/block/${block.number}`)">
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
            <span class="value hash" @click.stop="$router.push(`/address/${block.miner}`)">{{ formatHash(block.miner) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="pagination" v-if="!loading">
      <button 
        @click="loadPreviousPage" 
        :disabled="currentPage === 1 || loading"
        class="page-btn"
      >
        上一页
      </button>
      <span class="page-info">第 {{ currentPage }} 页</span>
      <button 
        @click="loadNextPage" 
        :disabled="loading"
        class="page-btn"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatUnits } from 'viem'
import { publicClient } from '../config/client'

const router = useRouter()

interface Block {
  number: bigint
  hash: string
  timestamp: bigint
  transactions: any[]
  gasUsed: bigint
  miner: string
}

const blocks = ref<Block[]>([])
const loading = ref(false)
const searchBlockNumber = ref('')
const currentPage = ref(1)
const pageSize = 20

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

const goToBlock = () => {
  const blockNum = parseInt(searchBlockNumber.value)
  if (!isNaN(blockNum) && blockNum > 0) {
    router.push(`/block/${blockNum}`)
  }
}

const refreshBlocks = async () => {
  await loadPage(currentPage.value)
}

const loadPage = async (page: number) => {
  loading.value = true
  try {
    const latestBlock = await publicClient.getBlockNumber()
    const startBlock = latestBlock - BigInt((page - 1) * pageSize)
    
    const newBlocks: Block[] = []
    for (let i = 0; i < pageSize; i++) {
      const blockNumber = startBlock - BigInt(i)
      if (blockNumber < 0n) break
      
      const block = await publicClient.getBlock({
        blockNumber,
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
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
  } finally {
    loading.value = false
  }
}

const loadPreviousPage = async () => {
  if (currentPage.value > 1) {
    currentPage.value--
    await loadPage(currentPage.value)
  }
}

const loadNextPage = async () => {
  currentPage.value++
  await loadPage(currentPage.value)
}

onMounted(() => {
  loadPage(1)
})
</script>

<style scoped>
.blocks {
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

.controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 300px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
}

.search-input:focus {
  border-color: #3b82f6;
}

.search-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.search-btn:hover {
  background: #2563eb;
}

.refresh-btn {
  background: #64748b;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: #475569;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.block-card {
  padding: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-card:hover {
  background: #f8fafc;
  border-color: #3b82f6;
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
  cursor: pointer;
}

.detail-row .value.hash:hover {
  text-decoration: underline;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 20px;
}

.page-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #2563eb;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #64748b;
  font-size: 0.9rem;
}
</style>
