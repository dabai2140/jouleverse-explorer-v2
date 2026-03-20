<template>
  <div class="address-detail">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1 v-if="loading">加载地址信息中...</h1>
      <h1 v-else>地址详情</h1>
    </div>

    <div v-if="!loading" class="address-info">
      <div class="info-section">
        <h2>地址信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value hash">{{ address }}</span>
          </div>
          <div class="info-item">
            <span class="label">余额</span>
            <span class="value">{{ loadingBalance ? '加载中...' : formatBalance(balance) }} {{ symbol }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="error">
      <p>加载地址信息失败</p>
      <button @click="$router.push('/')" class="btn-primary">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createPublicClient, http, formatEther, isAddress } from 'viem'
import { mainnet } from 'viem/chains'

interface Props {
  address: string
}

const props = defineProps<Props>()

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

const address = ref(props.address)
const balance = ref<bigint | null>(null)
const loading = ref(true)
const loadingBalance = ref(true)
const symbol = ref('J')

const formatBalance = (balance: bigint | null): string => {
  if (balance === null) return '0'
  return formatEther(balance)
}

const loadBalance = async () => {
  loadingBalance.value = true
  try {
    const balanceData = await client.getBalance({
      address: address.value as `0x${string}`,
    })
    balance.value = balanceData
  } catch (error) {
    console.error('Failed to fetch balance:', error)
    balance.value = null
  } finally {
    loadingBalance.value = false
  }
}

onMounted(() => {
  if (!isAddress(address.value)) {
    loading.value = false
    return
  }
  
  loadBalance().then(() => {
    loading.value = false
  })
})
</script>

<style scoped>
.address-detail {
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

.address-info {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.info-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
}

.info-section h2 {
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
