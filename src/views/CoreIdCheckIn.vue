<template>
  <div class="core-id-checkin">
    <div v-if="!walletStore.isConnected" class="checkin-block wallet-prompt">
      <h3>🔐 签到操作</h3>
      <p>签到操作需要连接钱包。</p>
    </div>

    <div v-else-if="walletStore.address?.toLowerCase() !== address.toLowerCase()" class="checkin-block wallet-warning">
      <h3>⚠️ 地址不匹配</h3>
      <p>当前连接的钱包地址不是此页面地址，无法代为签到。</p>
      <p>连接地址：{{ walletStore.formatAddress(walletStore.address) }}</p>
      <p>页面地址：{{ formatAddress(address) }}</p>
    </div>

    <div v-else class="checkin-block checkin-panel">
      <div class="wallet-info-badge">
        <span class="badge">✓ 钱包已连接</span>
        <span class="status" :class="{ live: isLive, expired: !isLive }">
          {{ isLive ? '活跃' : '已过期' }}
        </span>
      </div>

      <div class="checkin-stats">
        <div class="stat-row">
          <span class="stat-label">Core ID</span>
          <span class="stat-value">#{{ coreId.toString() }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">距上次签到</span>
          <span class="stat-value">{{ sinceLastCheckInText }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">最小签到间隔</span>
          <span class="stat-value">{{ formatDuration(minCheckInInterval) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">签到有效期</span>
          <span class="stat-value">{{ formatDuration(expireDuration) }}</span>
        </div>
      </div>

      <button @click="handleCheckIn" :disabled="loadingCheckIn || !canCheckIn" class="btn-primary">
        {{ checkInButtonText }}
      </button>
      <p v-if="checkInError" class="error-message">{{ checkInError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { createPublicClient, http } from 'viem'
import { useWalletStore } from '../stores/wallet'
import { jouleverseChain } from '../config/chain'
import { JVCORE_ADDRESS, jvcoreABI } from '../contracts/jvcore'
import type { NFTMetadata } from '../types/coreid'

interface Props {
  address: string
  coreId: bigint
  metadata: NFTMetadata | null
  formatAddress: (addr: string) => string
}

const props = defineProps<Props>()
const emit = defineEmits<{ checkedIn: [] }>()
const walletStore = useWalletStore()

const client = createPublicClient({ chain: jouleverseChain, transport: http() })

const minCheckInInterval = ref(0n)
const expireDuration = ref(0n)
const now = ref(Math.floor(Date.now() / 1000))

const loadingCheckIn = ref(false)
const checkInError = ref<string | null>(null)

// 最安全的错误处理函数（同 WJOperations.vue）
const safeErrorMessage = (error: unknown): string => {
  try {
    if (error === null || error === undefined) {
      return 'Unknown error'
    }
    if (typeof error === 'string') {
      return error
    }
    if (typeof error === 'object') {
      if ('message' in error && typeof (error as any).message === 'string') {
        return (error as any).message
      }
      if ('toString' in error && typeof (error as any).toString === 'function') {
        try {
          return (error as any).toString()
        } catch {
          return 'Could not convert error to string'
        }
      }
    }
    return String(error)
  } catch {
    return 'Could not parse error'
  }
}

const lastCheckInTime = computed(() => props.metadata?.lastCheckInTime ?? 0)
const isLive = computed(() => props.metadata?.liveness ?? false)
const sinceLastCheckIn = computed(() => Math.max(0, now.value - lastCheckInTime.value))
const canCheckIn = computed(() => sinceLastCheckIn.value >= Number(minCheckInInterval.value))

const sinceLastCheckInText = computed(() => {
  if (!lastCheckInTime.value) return '从未签到'
  return formatDuration(sinceLastCheckIn.value) + '前'
})

const checkInButtonText = computed(() => {
  if (loadingCheckIn.value) return '签到中...'
  if (canCheckIn.value) return '本月签到'
  const remaining = Number(minCheckInInterval.value) - sinceLastCheckIn.value
  return `还需等待 ${formatDuration(remaining)}`
})

// 秒数 -> "X天X小时"/"X小时X分钟"/"X分钟"
const formatDuration = (seconds: number | bigint): string => {
  const s = Number(seconds)
  if (s <= 0) return '0分钟'
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

const loadCheckInParams = async () => {
  try {
    const [interval, expire] = await Promise.all([
      client.readContract({
        address: JVCORE_ADDRESS,
        abi: jvcoreABI,
        functionName: 'minCheckInInterval',
      }),
      client.readContract({
        address: JVCORE_ADDRESS,
        abi: jvcoreABI,
        functionName: 'expireDuration',
      }),
    ])
    minCheckInInterval.value = interval
    expireDuration.value = expire
  } catch (err) {
    console.error('[CoreIdCheckIn] 读取签到参数失败:', err)
  }
}

const handleCheckIn = async () => {
  if (!walletStore.address) {
    checkInError.value = '钱包未连接'
    return
  }

  loadingCheckIn.value = true
  checkInError.value = null

  try {
    const { writeContract, switchChain, waitForTransactionReceipt } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    // 检查并切换到 Jouleverse 链
    console.log('[CoreIdCheckIn] Switching to Jouleverse...')
    try {
      await switchChain(wagmiConfig, { chainId: 3666 })
      console.log('[CoreIdCheckIn] Switched to Jouleverse')
    } catch (err) {
      console.log('[CoreIdCheckIn] Switch chain error (might already be on correct chain):', err)
    }

    console.log('[CoreIdCheckIn] Calling writeContract checkIn...')
    const hash = await writeContract(wagmiConfig, {
      address: JVCORE_ADDRESS,
      abi: jvcoreABI,
      functionName: 'checkIn',
      args: [props.coreId],
    })

    console.log('[CoreIdCheckIn] Transaction hash:', hash)
    alert(`签到交易已提交！\n哈希: ${hash}\n等待链上确认...`)

    // 必须等交易真正上链确认后才能重新读取tokenURI，否则liveness/lastCheckInTime还是旧值
    await waitForTransactionReceipt(wagmiConfig, { hash })
    console.log('[CoreIdCheckIn] Transaction confirmed')

    now.value = Math.floor(Date.now() / 1000)
    emit('checkedIn')
  } catch (error) {
    console.error('[CoreIdCheckIn] Check-in failed:', error)
    const errMessage = safeErrorMessage(error)
    console.error('[CoreIdCheckIn] Error message:', errMessage)
    checkInError.value = '签到失败: ' + errMessage
  } finally {
    loadingCheckIn.value = false
  }
}

onMounted(() => {
  loadCheckInParams()
})
</script>

<style scoped>
.core-id-checkin {
  margin-top: 16px;
}

.checkin-block {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
}

.checkin-block h3 {
  margin: 0 0 12px 0;
  font-size: 1.05rem;
  color: #1e293b;
}

.wallet-prompt {
  background: #eff6ff;
  border-color: #3b82f6 !important;
}

.wallet-prompt h3 {
  color: #1e40af;
}

.wallet-prompt p {
  margin: 0;
  color: #1e40af;
}

.wallet-warning {
  background: #fef3c7;
  border-color: #f59e0b !important;
}

.wallet-warning h3 {
  color: #92400e;
}

.wallet-warning p {
  margin: 8px 0;
  color: #92400e;
}

.checkin-panel {
  background: #f8fafc;
}

.wallet-info-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #dcfce7;
  border: 1px solid #22c551;
  border-radius: 8px;
  padding: 8px 16px;
  margin-bottom: 16px;
}

.wallet-info-badge .badge {
  color: #15803d;
  font-weight: 600;
}

.wallet-info-badge .status {
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
}

.wallet-info-badge .status.live {
  background: #dcfce7;
  color: #15803d;
}

.wallet-info-badge .status.expired {
  background: #fee2e2;
  color: #b91c1c;
}

.checkin-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.9rem;
}

.stat-label {
  color: #64748b;
}

.stat-value {
  color: #1e293b;
  font-weight: 500;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 8px 0 0 0;
}
</style>
