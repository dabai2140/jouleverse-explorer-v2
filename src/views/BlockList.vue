<template>
  <div class="block-list">
    <div class="page-header">
      <h1>Jouleverse 区块浏览器</h1>
      <p class="subtitle">Chain ID: 3666 | RPC: rpc.jnsdao.com:8503</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">最新区块高度</span>
        <span class="stat-value" v-if="latestBlockNumber !== null">#{{ latestBlockNumber }}</span>
        <span class="stat-value muted" v-else>加载中...</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">网络状态</span>
        <span class="stat-value" :class="isConnected ? 'success' : 'error'">
          {{ isConnected ? '✓ 已连接' : '✗ 未连接' }}
        </span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>最新区块</h2>
        <JvActionButton :loading="loading" @click="refreshBlocks">刷新</JvActionButton>
      </div>

      <JvLoading v-if="loading && blocks.length === 0" label="加载区块数据中..." />

      <div v-else-if="blocks.length > 0" class="blocks-list">
        <div
          v-for="(block, index) in blocks"
          :key="index"
          class="block-card"
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
              <JvHashText :value="block.miner" type="address" :truncate="8" :linkable="false" />
            </div>
          </div>
        </div>
      </div>

      <JvPageState v-else type="empty" title="暂无区块数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { formatAge, formatNumber } from '../utils/format'
import { publicClient } from '../config/client'
import { JvLoading, JvPageState, JvHashText, JvActionButton } from '../design-system'

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
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null


const refreshBlocks = async () => {
  loading.value = true
  try {
    const blockNumber = await publicClient.getBlockNumber()
    latestBlockNumber.value = blockNumber
    isConnected.value = true
    const fetched: Block[] = []
    for (let i = 0; i < 10; i++) {
      const b = await publicClient.getBlock({ blockNumber: blockNumber - BigInt(i) })
      fetched.push({ number: b.number, hash: b.hash || '', timestamp: b.timestamp, transactions: b.transactions, gasUsed: b.gasUsed, miner: b.miner })
    }
    blocks.value = fetched
  } catch {
    isConnected.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshBlocks()
  autoRefreshTimer = setInterval(refreshBlocks, 15000)
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<style scoped>
.block-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--jv-text-primary);
  margin: 0 0 8px 0;
}

.subtitle {
  color: var(--jv-text-muted);
  font-size: 0.875rem;
  margin: 0;
  font-family: var(--jv-font-mono);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  padding: 18px 20px;
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--jv-text-muted);
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.stat-value {
  display: block;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--jv-text-primary);
}

.stat-value.muted { color: var(--jv-text-muted); font-size: 1rem; }
.stat-value.success { color: var(--jv-success); }
.stat-value.error { color: var(--jv-error); }

.panel {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--jv-border);
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--jv-text-primary);
}

.blocks-list { display: flex; flex-direction: column; }

.block-card {
  padding: 14px 0;
  border-bottom: 1px solid var(--jv-border);
}

.block-card:last-child { border-bottom: none; }

.block-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.num-row { display: flex; align-items: center; gap: 4px; }
.block-num { font-size: 1.1rem; font-weight: 700; color: var(--jv-text-primary); }
.muted { color: var(--jv-text-muted); font-size: 0.85rem; }

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
</style>
