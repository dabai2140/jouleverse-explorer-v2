<template>
  <div class="home">
    <div class="header">
      <div class="logo">
        <svg width="40" height="40" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="256" fill="#EB1727"/>
          <path fill="#fefefe" d="M202.4025 130.5h127.195q.2 75-.5 150-5 79.5-82.5 97.5-34.4 6.2-68-3-54.3-18.8-64.5-75.5a133 133 0 0 1-2.5-28h56q3.2 66.9 69 55.5 27-8 33.5-35.5.3-4.3 2-13 .7-49 .5-98a1260 1260 0 0 0-71-1M305.6 226l60 100 60-100"/>
        </svg>
        <h1>Jouleverse Explorer</h1>
      </div>
      
      <div class="status-bar">
        <div class="status-indicator" :class="{ online: networkStatus === 'online', offline: networkStatus === 'offline' }">
          <div class="dot"></div>
          <span class="status-text">{{ networkStatus === 'online' ? '网络在线' : '网络离线' }}</span>
        </div>
        
        <div class="uptime" v-if="latestBlock">
          <span class="label">最新区块</span>
          <span class="value">#{{ latestBlock.number }}</span>
        </div>

        <div class="uptime" v-if="networkUptime">
          <span class="label">稳定运行</span>
          <span class="value">{{ networkUptime }}</span>
        </div>
      </div>
    </div>

    <div class="content">
      <!-- 搜索框 -->
      <div class="search-section">
        <div class="search-box">
          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="搜索区块、交易或地址..."
            class="search-input"
          >
          <button @click="handleSearch" class="search-btn">🔍 搜索</button>
        </div>
      </div>

      <!-- Timelock 能量信息 -->
      <div class="timelock-info">
        <div class="section-header">
          <h2>Timelock 能量信息</h2>
        </div>

        <div class="loading" v-if="timelockLoading">加载能量数据中...</div>

        <div class="timelock-cards" v-else>
          <div class="timelock-card" v-if="timelockCore">
            <div class="card-header">
              <span class="card-title">核心时间锁</span>
            </div>
            <div class="card-stats">
              <div class="stat-item">
                <span class="stat-label">月度预算</span>
                <span class="stat-value">{{ formatEnergy(timelockCore.monthlyBudget) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已使用</span>
                <span class="stat-value">{{ formatEnergy(timelockCore.used) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已释放</span>
                <span class="stat-value">{{ formatEnergy(timelockCore.released) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">可用余额</span>
                <span class="stat-value highlight">{{ formatEnergy(timelockCore.available) }}</span>
              </div>
            </div>
          </div>

          <div class="timelock-card" v-if="timelockEco">
            <div class="card-header">
              <span class="card-title">生态时间锁</span>
            </div>
            <div class="card-stats">
              <div class="stat-item">
                <span class="stat-label">月度预算</span>
                <span class="stat-value">{{ formatEnergy(timelockEco.monthlyBudget) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已使用</span>
                <span class="stat-value">{{ formatEnergy(timelockEco.used) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已释放</span>
                <span class="stat-value">{{ formatEnergy(timelockEco.released) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">可用余额</span>
                <span class="stat-value highlight">{{ formatEnergy(timelockEco.available) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 最新区块列表 -->
      <div class="latest-blocks">
        <div class="section-header">
          <h2>最新区块</h2>
          <button @click="$router.push('/blocks')" class="view-all-btn">查看全部 →</button>
        </div>

        <div class="loading" v-if="loading">加载区块数据中...</div>

        <div class="blocks-list" v-else-if="blocks.length > 0">
          <div v-for="(block, index) in blocks" :key="index" class="block-card" @click="$router.push(`/block/${block.number}`)">
            <div class="block-header">
              <div class="block-number">
                <span class="label">区块</span>
                <span class="value">#{{ block.number }}</span>
              </div>
              <div class="block-age">
                <span class="value">{{ formatAge(block.timestamp) }}</span>
              </div>
            </div>

            <div class="block-details">
              <div class="detail-row">
                <span class="label">哈希</span>
                <span class="value hash">{{ formatHash(block.hash) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">交易数</span>
                <span class="value">{{ block.transactions.length }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Gas</span>
                <span class="value">{{ formatNumber(block.gasUsed) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty" v-else>
          <p>暂无区块数据</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createPublicClient, http, formatUnits, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { timelockABI, TIMELOCK_CORE_ADDRESS, TIMELOCK_ECO_ADDRESS } from '../contracts/timelock'
import type { TimelockData } from '../contracts/timelock'

const jouleverse = {
  ...mainnet,
  id: 3666,
  name: 'Jouleverse',
  nativeCurrency: {
    name: 'Joule',
    symbol: 'J',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.jnsdao.com:8503'],
    },
  },
  blockExplorers: {
    default: { name: 'JScan', url: 'https://jscan.jnsdao.com' },
  },
}

const client = createPublicClient({
  chain: jouleverse,
  transport: http(),
})

interface Block {
  number: bigint
  hash: string
  timestamp: bigint
  transactions: any[]
  gasUsed: bigint
}

const networkStatus = ref<'online' | 'offline' | 'unknown'>('unknown')
const blocks = ref<Block[]>([])
const latestBlock = ref<Block | null>(null)
const loading = ref(false)
const searchQuery = ref('')
const networkUptime = ref<string>('')

// Timelock 能量数据
const timelockCore = ref<TimelockData | null>(null)
const timelockEco = ref<TimelockData | null>(null)
const timelockLoading = ref(false)

const formatAge = (timestamp: bigint): string => {
  const blockTime = Number(timestamp) * 1000
  const now = Date.now()
  const diff = Math.floor((now - blockTime) / 1000)

  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

const formatUptime = (genesisTimestamp: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - genesisTimestamp

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)

  if (days > 0) {
    return `${days}天${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const formatHash = (hash: string): string => {
  if (!hash) return ''
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
}

const formatNumber = (num: bigint): string => {
  return formatUnits(num, 0)
}

const formatEnergy = (num: bigint): string => {
  const value = Number(formatUnits(num, 18))
  
  // 处理非常大的数字（万、亿）
  if (value >= 100000000) {
    const formatted = (value / 100000000).toFixed(2)
    return (formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted) + '亿 J'
  } else if (value >= 10000) {
    const formatted = (value / 10000).toFixed(2)
    return (formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted) + '万 J'
  } else {
    const formatted = value.toFixed(2)
    return (formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted) + ' J'
  }
}

const fetchTimelockData = async (address: string) => {
  try {
    const [monthlyBudget, monthlyBlocks, used, released, available] = await Promise.all([
      client.readContract({
        address: address as `0x${string}`,
        abi: timelockABI,
        functionName: 'MONTHLY_BUDGET',
      }),
      client.readContract({
        address: address as `0x${string}`,
        abi: timelockABI,
        functionName: 'MONTHLY_BLOCKS',
      }),
      client.readContract({
        address: address as `0x${string}`,
        abi: timelockABI,
        functionName: 'used',
      }),
      client.readContract({
        address: address as `0x${string}`,
        abi: timelockABI,
        functionName: 'released',
      }),
      client.readContract({
        address: address as `0x${string}`,
        abi: timelockABI,
        functionName: 'available',
      }),
    ])

    return {
      monthlyBudget: monthlyBudget as bigint,
      monthlyBlocks: monthlyBlocks as bigint,
      used: used as bigint,
      released: released as bigint,
      available: available as bigint,
    }
  } catch (error) {
    console.error('Failed to fetch timelock data:', error)
    return null
  }
}

const fetchAllTimelockData = async () => {
  timelockLoading.value = true
  try {
    const [coreData, ecoData] = await Promise.all([
      fetchTimelockData(TIMELOCK_CORE_ADDRESS),
      fetchTimelockData(TIMELOCK_ECO_ADDRESS),
    ])
    timelockCore.value = coreData
    timelockEco.value = ecoData
  } catch (error) {
    console.error('Failed to fetch timelock data:', error)
  } finally {
    timelockLoading.value = false
  }
}

const fetchLatestBlocks = async () => {
  loading.value = true
  try {
    const latest = await client.getBlockNumber()

    // 获取创世区块（block 0）的时间戳
    const genesisBlock = await client.getBlock({ blockNumber: 0n })
    if (genesisBlock) {
      networkUptime.value = formatUptime(Number(genesisBlock.timestamp))
    }

    // 获取最新区块检查网络状态
    const latestBlockData = await client.getBlock({ blockNumber: latest })
    if (latestBlockData) {
      latestBlock.value = {
        number: latestBlockData.number,
        hash: latestBlockData.hash || '',
        timestamp: latestBlockData.timestamp,
        transactions: latestBlockData.transactions,
        gasUsed: latestBlockData.gasUsed,
      }

      // 检查网络状态
      const currentTime = Math.floor(Date.now() / 1000)
      const timeDiff = currentTime - Number(latestBlockData.timestamp)
      networkStatus.value = timeDiff < 300 ? 'online' : 'offline' // 5分钟内有新区块则在线
    }

    // 获取最近10个区块
    const newBlocks: Block[] = []
    for (let i = 0; i < 10; i++) {
      const blockNumber = latest - BigInt(i)
      const block = await client.getBlock({ blockNumber })
      if (block) {
        newBlocks.push({
          number: block.number,
          hash: block.hash || '',
          timestamp: block.timestamp,
          transactions: block.transactions,
          gasUsed: block.gasUsed,
        })
      }
    }
    
    blocks.value = newBlocks
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
    networkStatus.value = 'offline'
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  const query = searchQuery.value.trim()
  if (!query) return
  
  // 检查是否为区块号
  if (/^\d+$/.test(query)) {
    window.location.href = `/block/${query}`
    return
  }
  
  // 检查是否为地址（以太坊地址格式）
  if (isAddress(query)) {
    window.location.href = `/address/${query}`
    return
  }
  
  // 检查是否为交易哈希
  if (query.length === 66 && query.startsWith('0x')) {
    window.location.href = `/tx/${query}`
    return
  }
  
  // 默认尝试作为区块号
  window.location.href = `/block/${query}`
}

onMounted(() => {
  fetchLatestBlocks()
  fetchAllTimelockData()
  // 每30秒刷新区块数据
  setInterval(fetchLatestBlocks, 30000)
})
</script>

<style scoped>
.home {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
}

.header {
  padding: 30px 0;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 30px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.logo svg {
  flex-shrink: 0;
}

.logo h1 {
  color: #1e293b;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.status-bar {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 20px;
}

.status-indicator .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #64748b;
}

.status-indicator.online .dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.status-indicator.offline .dot {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

.status-text {
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
}

.uptime {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 20px;
}

.uptime .label {
  color: #64748b;
  font-size: 0.9rem;
}

.uptime .value {
  color: #1e293b;
  font-weight: 600;
  font-size: 0.9rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.search-section {
  padding: 0;
}

.search-box {
  display: flex;
  gap: 12px;
  max-width: 600px;
}

.search-input {
  flex: 1;
  padding: 14px 18px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.timelock-info {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.timelock-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.timelock-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.card-title {
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 600;
}

.card-address {
  color: #64748b;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
}

.card-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  color: #64748b;
  font-size: 0.8rem;
}

.stat-value {
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.stat-value.highlight {
  color: #3b82f6;
}

.latest-blocks {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  color: #1e293b;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.view-all-btn {
  background: none;
  color: #3b82f6;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-all-btn:hover {
  background: #eff6ff;
}

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
  font-size: 1rem;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-card {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-card:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.block-number {
  display: flex;
  align-items: center;
  gap: 6px;
}

.block-number .label {
  color: #64748b;
  font-size: 0.9rem;
}

.block-number .value {
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 600;
}

.block-age .value {
  color: #64748b;
  font-size: 0.9rem;
}

.block-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row .label {
  color: #64748b;
  font-size: 0.85rem;
}

.detail-row .value {
  color: #1e293b;
  font-size: 0.9rem;
}

.detail-row .value.hash {
  font-family: 'Courier New', monospace;
  color: #3b82f6;
}

@media (max-width: 768px) {
  .header {
    padding: 20px 0;
  }
  
  .logo h1 {
    font-size: 1.5rem;
  }
  
  .status-bar {
    flex-direction: column;
    gap: 12px;
  }
  
  .search-box {
    max-width: 100%;
  }
  
  .timelock-cards {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .block-details {
    grid-template-columns: 1fr;
  }
}
</style>
