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
            <span class="value hash">{{ transaction.hash }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <span class="value" :class="{ success: transaction.status === 'success', error: transaction.status === 'reverted' }">
              {{ transaction.status === 'success' ? '成功' : '失败' }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">区块</span>
            <span class="value" @click="$router.push(`/block/${transaction.blockNumber}`)">
              #{{ transaction.blockNumber }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">时间戳</span>
            <span class="value">{{ formatTimestamp(transaction.blockTimestamp) }}</span>
          </div>
          <div class="info-item">
            <span class="label">发送方</span>
            <span class="value hash" @click="$router.push(`/address/${transaction.from}`)">{{ transaction.from }}</span>
          </div>
          <div class="info-item">
            <span class="label">接收方</span>
            <span class="value hash" @click="$router.push(`/address/${transaction.to}`)">
              {{ transaction.to || '合约创建' }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">发送金额</span>
            <span class="value">{{ formatValue(transaction.value) }} {{ symbol }}</span>
          </div>
          <div class="info-item" v-if="transaction.gasPrice">
            <span class="label">Gas 价格</span>
            <span class="value">{{ formatGas(transaction.gasPrice) }} Gwei</span>
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
            <span class="label">Gas 费用</span>
            <span class="value">{{ formatValue(transaction.gasUsed || 0n * (transaction.gasPrice || 0n)) }} {{ symbol }}</span>
          </div>
          <div class="info-item">
            <span class="label">随机数</span>
            <span class="value">{{ transaction.nonce }}</span>
          </div>
          <div class="info-item">
            <span class="label">输入数据</span>
            <span class="value hash">{{ formatInput(transaction.input) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="error">
      <p>未找到交易: {{ txHash }}</p>
      <button @click="$router.push('/')" class="btn-primary">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createPublicClient, http, formatUnits, formatEther } from 'viem'
import { mainnet } from 'viem/chains'

interface Props {
  hash: string
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
    default: { name: 'JScan', url: 'https://jscan.jns' },
  },
}

const client = createPublicClient({
  chain: jouleverse,
  transport: http(),
})

const transaction = ref<any>(null)
const loading = ref(true)
const txHash = ref(props.hash)
const symbol = ref('J')

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

const formatValue = (value: bigint): string => {
  return formatEther(value)
}

const formatGas = (gas: bigint): string => {
  return formatUnits(gas, 9)
}

const formatNumber = (num: bigint): string => {
  return formatUnits(num, 0)
}

const formatInput = (input: string): string => {
  if (!input || input === '0x') return '无'
  if (input.length <= 50) return input
  return `${input.substring(0, 50)}...`
}

const loadTransaction = async () => {
  loading.value = true
  try {
    const txData = await client.getTransaction({
      hash: props.hash as `0x${string}`,
    })
    
    const receipt = await client.getTransactionReceipt({
      hash: props.hash as `0x${string}`,
    })
    
    const block = await client.getBlock({
      blockNumber: txData.blockNumber!,
    })
    
    transaction.value = {
      ...txData,
      ...receipt,
      blockTimestamp: block.timestamp,
    }
  } catch (error) {
    console.error('Failed to fetch transaction:', error)
    transaction.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTransaction()
})
</script>

<style scoped>
.transaction-detail {
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

.transaction-info {
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
  cursor: pointer;
}

.info-item .value.hash:hover {
  text-decoration: underline;
}

.info-item .value.success {
  color: #10b981;
  font-weight: 600;
}

.info-item .value.error {
  color: #ef4444;
  font-weight: 600;
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
