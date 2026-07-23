<template>
  <div class="blocks">
    <div class="page-header">
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
      <JvActionButton :loading="loading" @click="refreshBlocks">刷新</JvActionButton>
    </div>

    <JvLoading v-if="loading && blocks.length === 0" label="加载区块数据中..." />

    <div v-else-if="blocks.length > 0" class="blocks-list">
      <div
        v-for="(block, index) in blocks"
        :key="index"
        class="block-card"
        @click="$router.push(`/block/${block.number}`)"
      >
        <div class="block-card-head">
          <div class="num-row">
            <span class="muted">区块 #</span>
            <span class="block-num">{{ block.number }}</span>
          </div>
          <span class="muted">{{ formatAge(block.timestamp) }}</span>
        </div>
        <div class="block-card-body">
          <div class="meta-row">
            <span class="muted">区块哈希</span>
            <JvHashText :value="block.hash" type="block" :truncate="8" :linkable="false" />
          </div>
          <div class="meta-row">
            <span class="muted">交易数</span>
            <span>{{ block.transactions.length }}</span>
          </div>
          <div class="meta-row">
            <span class="muted">Gas 使用</span>
            <span>{{ formatNumber(block.gasUsed) }}</span>
          </div>
          <div class="meta-row">
            <span class="muted">矿工</span>
            <JvHashText
              :value="block.miner"
              type="address"
              :truncate="8"
              @click.stop="$router.push(`/address/${block.miner}`)"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="pagination">
      <button
        @click="loadPreviousPage"
        :disabled="currentPage === 1"
        class="page-btn"
      >← 上一页</button>
      <span class="page-info">第 {{ currentPage }} 页</span>
      <button
        @click="loadNextPage"
        :disabled="loading"
        class="page-btn"
      >下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatAge, formatNumber } from '../utils/format'
import { publicClient } from '../config/client'
import { JvLoading, JvHashText, JvActionButton } from '../design-system'

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


const goToBlock = () => {
  const n = parseInt(searchBlockNumber.value)
  if (!isNaN(n) && n > 0) router.push(`/block/${n}`)
}

const refreshBlocks = () => loadPage(currentPage.value)

const loadPage = async (page: number) => {
  loading.value = true
  try {
    const latest = await publicClient.getBlockNumber()
    const start = latest - BigInt((page - 1) * pageSize)
    const fetched: Block[] = []
    for (let i = 0; i < pageSize; i++) {
      const n = start - BigInt(i)
      if (n < 0n) break
      const b = await publicClient.getBlock({ blockNumber: n })
      fetched.push({
        number: b.number,
        hash: b.hash || '',
        timestamp: b.timestamp,
        transactions: b.transactions,
        gasUsed: b.gasUsed,
        miner: b.miner,
      })
    }
    blocks.value = fetched
  } catch (e) {
    console.error('Failed to fetch blocks:', e)
  } finally {
    loading.value = false
  }
}

const loadPreviousPage = async () => {
  if (currentPage.value > 1) { currentPage.value--; await loadPage(currentPage.value) }
}

const loadNextPage = async () => {
  currentPage.value++; await loadPage(currentPage.value)
}

onMounted(() => loadPage(1))
</script>

<style scoped>
.blocks {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header { margin-bottom: 24px; }

.back-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-muted);
  border: none;
  padding: 8px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  margin-bottom: 16px;
  display: inline-block;
  transition: background var(--jv-duration-fast) var(--jv-ease);
}
.back-btn:hover { background: var(--jv-bg-hover); }

.page-header h1 { color: var(--jv-text-primary); margin: 0; }

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.search-box {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 280px;
}

.search-input {
  flex: 1;
  padding: 9px 14px;
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  font-size: 0.9rem;
  background: var(--jv-bg-surface);
  color: var(--jv-text-primary);
  outline: none;
  transition: border-color var(--jv-duration-fast) var(--jv-ease);
}

.search-input:focus {
  border-color: var(--jv-border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--jv-brand) 12%, transparent);
}

.search-btn {
  padding: 9px 16px;
  background: var(--jv-brand);
  color: #fff;
  border: none;
  border-radius: var(--jv-radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--jv-duration-fast) var(--jv-ease);
  white-space: nowrap;
}
.search-btn:hover { background: var(--jv-brand-hover); }

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.block-card {
  padding: 14px 16px;
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  transition: background var(--jv-duration-fast) var(--jv-ease),
              border-color var(--jv-duration-fast) var(--jv-ease);
}

.block-card:hover {
  background: var(--jv-brand-subtle);
  border-color: var(--jv-brand);
}

.block-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.num-row { display: flex; align-items: center; gap: 4px; }
.block-num { font-size: 1.1rem; font-weight: 700; color: var(--jv-text-primary); }

.block-card-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 6px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--jv-text-secondary);
}

.muted { color: var(--jv-text-muted); font-size: 0.85rem; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}

.page-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-secondary);
  border: 1px solid var(--jv-border);
  padding: 8px 18px;
  border-radius: var(--jv-radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--jv-duration-fast) var(--jv-ease),
              border-color var(--jv-duration-fast) var(--jv-ease);
}

.page-btn:hover:not(:disabled) {
  background: var(--jv-brand-subtle);
  border-color: var(--jv-brand);
  color: var(--jv-brand);
}

.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-info { color: var(--jv-text-muted); font-size: 0.875rem; }
</style>
