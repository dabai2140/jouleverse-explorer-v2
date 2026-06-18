<template>
  <div class="address-detail">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1>地址详情</h1>
    </div>

    <div v-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="$router.push('/')" class="btn-primary">返回首页</button>
    </div>

    <div v-else class="address-info">
      <div class="info-section">
        <h2>📍 地址信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value hash">{{ formatAddress(address) }}</span>
          </div>
          <div class="info-item">
            <span class="label">能量余额</span>
            <span class="value">{{ loadingBalance ? '⏳ 加载中...' : formatBalance(balance) }} {{ symbol }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h2>💰 Wrapped Joule (wJ)</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">wJ 余额</span>
            <span class="value">{{ loadingWJ ? '⏳ 加载中...' : formatBalance(wjBalance) }} wJ</span>
          </div>
          <div class="info-item">
            <span class="label">合约地址</span>
            <span class="value hash">{{ formatAddress(WJ_ADDRESS) }}</span>
          </div>
        </div>
        <div class="info-note">
          <p>ℹ️ wJ 是 Joule 的 ERC20 代币包装版本。1 wJ = 1 J，可以自由转账。</p>
        </div>
      <WJOperations :address="address" :wjBalance="wjBalance" :formatAddress="formatAddress" :formatBalance="formatBalance" />
</div>

      <div class="info-section">
        <h2>📜 交易历史</h2>
        <div class="transactions-header">
          <span>显示第 {{ currentPage }} 页（每页10个区块）</span>
          <div class="pagination" v-if="totalPages > 1">
            <button @click="prevPage" :disabled="currentPage === 1" class="page-btn">←</button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="nextPage" :disabled="currentPage === totalPages" class="page-btn">→</button>
          </div>
        </div>
        
        <div class="block-selector">
          <span class="block-label">跳转到区块：</span>
          <input 
            v-model="targetBlock" 
            type="number" 
            placeholder="输入区块高度"
            class="block-input"
            :min="0"
            :max="Number(maxBlock)"
          >
          <button @click="jumpToBlock" class="jump-btn">跳转</button>
        </div>

        <div class="loading" v-if="loadingTxs">加载交易记录中...</div>

        <div class="transactions-list" v-else-if="transactions.length > 0">
          <div v-for="(tx, index) in transactions" :key="index" class="tx-card" @click="$router.push(`/tx/${tx.hash}`)">
            <div class="tx-header">
              <div class="tx-hash">
                <span class="label">交易哈希</span>
                <span class="value hash">{{ formatHash(tx.hash) }}</span>
              </div>
              <div class="tx-age">
                <span class="value">{{ tx.age }}</span>
              </div>
            </div>
            <div class="tx-details">
              <div class="detail-row">
                <span class="label">区块</span>
                <span class="value">#{{ tx.blockNumber }}</span>
              </div>
              <div class="detail-row">
                <span class="label">发送者</span>
                <span class="value hash">{{ formatAddress(tx.from) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">接收者</span>
                <span class="value hash">{{ tx.to ? formatAddress(tx.to) : '合约创建' }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Gas</span>
                <span class="value">{{ formatGas(tx.gasUsed) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty" v-else>
          <p>暂无交易记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatEther, isAddress, formatUnits } from 'viem'
import { WJ_ADDRESS, wjABI } from '../contracts/wj'
import WJOperations from './WJOperations.vue'
import { publicClient } from '../config/client'
// import { useWalletStore } from '../stores/wallet'

const router = useRouter()
// const walletStore = useWalletStore() // 后续用于 WJ 操作功能

interface Props {
  address: string
  blockNumber?: string
}

const props = defineProps<Props>()

const address = ref(props.address)
const balance = ref<bigint | null>(null)
const wjBalance = ref<bigint | null>(null)
const error = ref<string | null>(null)
const loadingBalance = ref(true)
const loadingWJ = ref(true)

// 交易相关
const transactions = ref<any[]>([])
const loadingTxs = ref(false)
const currentPage = ref(1)
const totalTxs = ref(0)
const totalPages = ref(1)
const maxBlock = ref<bigint>(0n)
const targetBlock = ref('')

const symbol = ref('J')

const formatAddress = (addr: string): string => {
  if (!addr) return ''
  return `${addr.substring(0, 10)}...${addr.substring(addr.length - 8)}`
}

const formatBalance = (balance: bigint | null): string => {
  if (balance === null || balance === 0n) return '0'
  return parseFloat(formatEther(balance)).toFixed(4)
}

const formatHash = (hash: string): string => {
  if (!hash) return ''
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
}

const formatGas = (gas: bigint): string => {
  return formatUnits(gas, 0)
}

const loadBalance = async () => {
  loadingBalance.value = true
  try {
    const balanceData = await publicClient.getBalance({
      address: address.value as `0x${string}`,
    })
    balance.value = balanceData
  } catch (err) {
    console.error('Failed to fetch balance:', err)
    error.value = '获取能量余额失败'
    balance.value = null
  } finally {
    loadingBalance.value = false
  }
}

const loadWJBalance = async () => {
  loadingWJ.value = true
  try {
    const balanceData = await publicClient.readContract({
      address: WJ_ADDRESS,
      abi: wjABI,
      functionName: 'balanceOf',
      args: [address.value as `0x${string}`],
    })
    wjBalance.value = balanceData as bigint
  } catch (err) {
    console.error('Failed to fetch WJ balance:', err)
    // WJ 余额查询失败不影响主要功能，不设置全局错误
    wjBalance.value = null
  } finally {
    loadingWJ.value = false
  }
}

const loadTransactions = async (page: number) => {
  loadingTxs.value = true
  try {
    const latestBlock = await publicClient.getBlockNumber()
    maxBlock.value = latestBlock
    
    // ✅ 清空当前交易列表，准备加载新页面
    transactions.value = []
    
    // 计算要扫描的区块范围（每页10个区块）
    const blocksPerPage = 10
    const startBlock = latestBlock - BigInt((page - 1) * blocksPerPage)
    const endBlock = latestBlock - BigInt(page * blocksPerPage)
    
    let txCount = 0
    
    for (let blockNumber = startBlock; blockNumber > endBlock && blockNumber >= 0n; blockNumber--) {
      const block = await publicClient.getBlock({ blockNumber })
      
      if (block && block.transactions.length > 0) {
        for (const tx of block.transactions) {
          try {
            const txData = await publicClient.getTransaction({ hash: tx as `0x${string}` })
            if (txData && 
                (txData.from.toLowerCase() === address.value.toLowerCase() || 
                 (txData.to && txData.to.toLowerCase() === address.value.toLowerCase()))) {
              const receipt = await publicClient.getTransactionReceipt({ hash: tx as `0x${string}` })
              
              // 计算区块年龄
              let age = ''
              try {
                if (block && block.timestamp) {
                  const blockTime = Number(block.timestamp) * 1000
                  const now = Date.now()
                  const diff = Math.floor((now - blockTime) / 1000)

                  if (diff < 60) age = `${diff} 秒前`
                  else if (diff < 3600) age = `${Math.floor(diff / 60)} 分钟前`
                  else if (diff < 86400) age = `${Math.floor(diff / 3600)} 小时前`
                  else age = `${Math.floor(diff / 86400)} 天前`
                }
              } catch (error) {
                // 忽略年龄计算错误
              }
              
              // ✅ 渐进式加载：立即添加到交易列表
              transactions.value.push({
                hash: txData.hash,
                from: txData.from,
                to: txData.to,
                blockNumber: txData.blockNumber,
                gasUsed: receipt?.gasUsed || 0n,
                age: age,
              })
              
              txCount++
            }
          } catch (error) {
            // 忽略错误
          }
        }
      }
    }
    
    totalTxs.value = txCount
    totalPages.value = Math.ceil(Number(latestBlock) / blocksPerPage)
    
    // 显示当前页的所有交易（已经在循环中渐进添加了）
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
    transactions.value = []
    totalTxs.value = 0
    totalPages.value = 1
  } finally {
    loadingTxs.value = false
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTransactions(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTransactions(currentPage.value)
  }
}

const jumpToBlock = async () => {
  if (!targetBlock.value || isNaN(Number(targetBlock.value))) {
    return
  }
  
  const targetBlockNum = BigInt(targetBlock.value)
  if (targetBlockNum < 0 || targetBlockNum > maxBlock.value) {
    return
  }
  
  // 计算应该跳转到哪一页
  const blocksPerPage = 10
  const page = Math.floor((Number(maxBlock.value) - Number(targetBlockNum)) / blocksPerPage) + 1
  
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  await loadTransactions(currentPage.value)
  
  // 更新 URL
  router.push({
    name: 'addressDetailWithBlock',
    params: {
      address: props.address,
      blockNumber: targetBlock.value
    }
  })
}

onMounted(async () => {
  if (!isAddress(address.value)) {
    error.value = '无效的地址格式'
    return
  }
  
  // ✅ 渐进式加载：立即开始所有数据加载，不等待
  loadBalance()
  loadWJBalance()
  
  // 检查 URL 中是否有 blockNumber 参数
  if (props.blockNumber) {
    const targetBlockNum = Number(props.blockNumber)
    if (!isNaN(targetBlockNum)) {
      // 先加载一次以获取 maxBlock
      await loadTransactions(1)
      
      // 跳转到指定区块
      targetBlock.value = String(targetBlockNum)
      await jumpToBlock()
    } else {
      await loadTransactions(1)
    }
  } else {
    await loadTransactions(1)
  }
})
</script>

<style scoped>
.address-detail {
  width: 100%;
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
  border-radius: 12px;
  padding: 24px;
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
  border-radius: 8px;
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

.info-note {
  margin-top: 16px;
  padding: 12px;
  background: #eff6ff;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.info-note p {
  margin: 0;
  color: #1e40af;
  font-size: 0.9rem;
}

.transactions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  background: #f1f5f9;
  color: #64748b;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #64748b;
  font-size: 0.9rem;
}

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
  font-size: 1rem;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tx-card {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tx-card:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tx-hash {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tx-hash .label {
  color: #64748b;
  font-size: 0.9rem;
}

.tx-hash .value {
  color: #1e293b;
  font-size: 1rem;
}

.tx-age .value {
  color: #64748b;
  font-size: 0.9rem;
}

.tx-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row .label {
  color: #64748b;
  font-size: 0.8rem;
}

.detail-row .value {
  color: #1e293b;
  font-size: 0.9rem;
}

.detail-row .value.hash {
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

.block-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.block-label {
  color: #64748b;
  font-size: 0.9rem;
}

.block-input {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
  min-width: 150px;
}

.block-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.jump-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.jump-btn:hover {
  background: #2563eb;
}
</style>
