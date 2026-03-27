<template>
  <div class="wj-operations">
    <div v-if="!walletStore.isConnected" class="info-section wallet-prompt">
      <h2>🔐 钱包操作</h2>
      <p>WJ 操作功能需要连接钱包。</p>
    </div>

    <div v-else-if="walletStore.address?.toLowerCase() !== address.toLowerCase()" class="info-section wallet-warning">
      <h2>⚠️ 地址不匹配</h2>
      <p>当前连接的钱包地址不是此页面地址，无法操作。</p>
      <p>连接地址：{{ walletStore.formatAddress(walletStore.address) }}</p>
      <p>页面地址：{{ formatAddress(address) }}</p>
    </div>

    <div v-else class="info-section wj-operations">
      <h2>🔧 WJ 操作</h2>
      <div class="wallet-info-badge">
        <span class="badge">✓ 钱包已连接</span>
        <span class="balance">可用 WJ：{{ formatBalance(wjBalance) }} WJ</span>
      </div>

      <div class="operation-tabs">
        <button :class="{ active: activeTab === 'withdraw' }" @click="activeTab = 'withdraw'" class="tab-btn">💰 释放 J</button>
        <button :class="{ active: activeTab === 'transfer' }" @click="activeTab = 'transfer'" class="tab-btn">➡️ 转账 WJ</button>
      </div>

      <div v-if="activeTab === 'withdraw'" class="operation-form">
        <div class="form-group">
          <label>目标地址（将 J 释放到此地址）</label>
          <input v-model="withdrawForm.to" placeholder="0x..." class="form-input">
        </div>
        <div class="form-group">
          <label>数量 (WJ)</label>
          <input
            v-model="withdrawForm.amount"
            type="text"
            placeholder="0.0"
            class="form-input"
            min="0"
            step="0.000000000000000001"
            @input="handleAmountInput('withdraw', $event)"
          >
          <span class="balance-hint">可用：{{ formatBalance(wjBalance) }} WJ</span>
        </div>
        <button @click="handleWithdraw" :disabled="loadingOperation || !withdrawForm.to || !withdrawForm.amount" class="btn-primary">
          {{ loadingOperation ? '处理中...' : '释放 J' }}
        </button>
        <p v-if="operationError" class="error-message">{{ operationError }}</p>
      </div>

      <div v-if="activeTab === 'transfer'" class="operation-form">
        <div class="form-group">
          <label>接收地址</label>
          <input v-model="transferForm.to" placeholder="0x..." class="form-input">
        </div>
        <div class="form-group">
          <label>数量 (WJ)</label>
          <input
            v-model="transferForm.amount"
            type="text"
            placeholder="0.0"
            class="form-input"
            min="0"
            step="0.000000000000000001"
            @input="handleAmountInput('transfer', $event)"
          >
          <span class="balance-hint">可用：{{ formatBalance(wjBalance) }} WJ</span>
        </div>
        <button @click="handleTransfer" :disabled="loadingOperation || !transferForm.to || !transferForm.amount" class="btn-primary">
          {{ loadingOperation ? '处理中...' : '转账' }}
        </button>
        <p v-if="operationError" class="error-message">{{ operationError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { parseEther } from 'viem'
import { useWalletStore } from '../stores/wallet'
import { WJ_ADDRESS, wjABI } from '../contracts/wj'

interface Props {
  address: string
  wjBalance: bigint | null
  formatAddress: (addr: string) => string
  formatBalance: (bal: bigint | null) => string
}

const props = defineProps<Props>()
const walletStore = useWalletStore()

const activeTab = ref<'withdraw' | 'transfer'>('withdraw')
const loadingOperation = ref(false)
const operationError = ref<string | null>(null)
const withdrawForm = ref({ to: '', amount: '' })
const transferForm = ref({ to: '', amount: '' })

// 最安全的错误处理函数
const safeErrorMessage = (error: unknown): string => {
  try {
    if (error === null || error === undefined) {
      return 'Unknown error'
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof error === 'object') {
      // 检查是否有 message 属性
      if ('message' in error && typeof (error as any).message === 'string') {
        return (error as any).message
      }

      // 检查是否有 toString 方法
      if ('toString' in error && typeof (error as any).toString === 'function') {
        try {
          return (error as any).toString()
        } catch {
          return 'Could not convert error to string'
        }
      }
    }

    // 最后尝试 String()
    return String(error)
  } catch {
    return 'Could not parse error'
  }
}

// 处理数量输入，确保只允许正数
const handleAmountInput = (type: 'withdraw' | 'transfer', event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value

  // 移除非数字字符（除了小数点）
  value = value.replace(/[^\d.]/g, '')

  // 确保只有一个小数点
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('')
  }

  // 更新值
  if (type === 'withdraw') {
    withdrawForm.value.amount = value
  } else {
    transferForm.value.amount = value
  }
}

const handleWithdraw = async () => {
  if (!walletStore.address) {
    operationError.value = '钱包未连接'
    return
  }

  loadingOperation.value = true
  operationError.value = null

  try {
    const to = withdrawForm.value.to
    console.log('[WJOperations] withdrawForm.value:', JSON.stringify(withdrawForm.value))
    console.log('[WJOperations] withdrawForm.value.amount:', withdrawForm.value.amount)
    console.log('[WJOperations] withdrawForm.value.amount type:', typeof withdrawForm.value.amount)
    console.log('[WJOperations] withdrawForm.value.amount == null:', withdrawForm.value.amount == null)
    console.log('[WJOperations] withdrawForm.value.amount == undefined:', withdrawForm.value.amount == undefined)

    const amountStr = String(withdrawForm.value.amount || '0')
    console.log('[WJOperations] amountStr1:', amountStr)
    console.log('[WJOperations] amountStr type:', typeof amountStr)
    console.log('[WJOperations] amountStr length:', amountStr.length)
    console.log('[WJOperations] amountStr char codes:', amountStr.split('').map(c => c.charCodeAt(0)))

    // 检查 amountStr 是否是有效的正数
    if (!/^\d*\.?\d+$/.test(amountStr) && amountStr !== '0') {
      throw new Error(`无效的数量: "${amountStr}"，请输入正数`)
    }

    const amount = parseEther(amountStr)

    console.log('[WJOperations] Starting withdraw...')
    console.log('[WJOperations] to:', to)
    console.log('[WJOperations] amount (bigint):', amount)
    console.log('[WJOperations] as number:', Number(amount))
    console.log('[WJOperations] amount < 0:', amount < 0n)

    const { writeContract, switchChain } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    // 检查并切换到 Jouleverse 链
    console.log('[WJOperations] Switching to Jouleverse...')
    try {
      await switchChain(wagmiConfig, { chainId: 3666 })
      console.log('[WJOperations] Switched to Jouleverse')
    } catch (err) {
      console.log('[WJOperations] Switch chain error (might already be on correct chain):', err)
    }

    console.log('[WJOperations] Calling writeContract...')
    const hash = await writeContract(wagmiConfig, {
      address: WJ_ADDRESS,
      abi: wjABI,
      functionName: 'withdrawTo',
      args: [to as `0x${string}`, amount],
    })

    console.log('[WJOperations] Transaction hash:', hash)
    alert(`释放 J 交易已提交！\n哈希: ${hash}`)

    await walletStore.refreshBalances()
    withdrawForm.value = { to: '', amount: '' }
  } catch (error) {
    console.error('[WJOperations] Withdraw failed:', error)
    const errMessage = safeErrorMessage(error)
    console.error('[WJOperations] Error message:', errMessage)
    operationError.value = '释放 J 失败: ' + errMessage
  } finally {
    loadingOperation.value = false
  }
}

const handleTransfer = async () => {
  if (!walletStore.address) {
    operationError.value = '钱包未连接'
    return
  }

  loadingOperation.value = true
  operationError.value = null

  try {
    const to = transferForm.value.to
    console.log('[WJOperations] transferForm.value:', JSON.stringify(transferForm.value))
    console.log('[WJOperations] transferForm.value.amount:', transferForm.value.amount)
    console.log('[WJOperations] transferForm.value.amount type:', typeof transferForm.value.amount)
    console.log('[WJOperations] transferForm.value.amount == null:', transferForm.value.amount == null)
    console.log('[WJOperations] transferForm.value.amount == undefined:', transferForm.value.amount == undefined)

    const amountStr = String(transferForm.value.amount || '0')
    console.log('[WJOperations] amountStr:', amountStr)
    console.log('[WJOperations] amountStr type:', typeof amountStr)
    console.log('[WJOperations] amountStr length:', amountStr.length)
    console.log('[WJOperations] amountStr char codes:', amountStr.split('').map(c => c.charCodeAt(0)))

    // 检查 amountStr 是否是有效的正数
    if (!/^\d*\.?\d+$/.test(amountStr) && amountStr !== '0') {
      throw new Error(`无效的数量: "${amountStr}"，请输入正数`)
    }

    const amount = parseEther(amountStr)

    console.log('[WJOperations] Starting transfer...')
    console.log('[WJOperations] to:', to)
    console.log('[WJOperations] amount (bigint):', amount)
    console.log('[WJOperations] amount as number:', Number(amount))
    console.log('[WJOperations] amount < 0:', amount < 0n)

    const { writeContract, switchChain } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    // 检查并切换到 Jouleverse 链
    console.log('[WJOperations] Switching to Jouleverse...')
    try {
      await switchChain(wagmiConfig, { chainId: 3666 })
      console.log('[WJOperations] Switched to Jouleverse')
    } catch (err) {
      console.log('[WJOperations] Switch chain error (might already be on correct chain):', err)
    }

    console.log('[WJOperations] Calling writeContract...')
    const hash = await writeContract(wagmiConfig, {
      address: WJ_ADDRESS,
      abi: wjABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, amount],
    })

    console.log('[WJOperations] Transaction hash:', hash)
    alert(`转账交易已提交！\n哈希: ${hash}`)

    await walletStore.refreshBalances()
    transferForm.value = { to: '', amount: '' }
  } catch (error) {
    console.error('[WJOperations] Transfer failed:', error)
    const errMessage = safeErrorMessage(error)
    console.error('[WJOperations] Error message:', errMessage)
    operationError.value = '转账失败: ' + errMessage
  } finally {
    loadingOperation.value = false
  }
}
</script>

<style scoped>
.wj-operations {
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

.wallet-prompt {
  background: #eff6ff;
  border-color: #3b82f6 !important;
}

.wallet-prompt h2 {
  color: #1e40af;
}

.wallet-prompt p {
  margin: 0 0 12px 0;
  color: #1e40af;
}

.wallet-warning {
  background: #fef3c7;
  border-color: #f59e0b !important;
}

.wallet-warning h2 {
  color: #92400e;
}

.wallet-warning p {
  margin: 8px 0;
  color: #92400e;
}

.wallet-info-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #dcfce7;
  border: 1px solid #22c551;
  border-radius: 8px;
  padding: 8px 16px;
  margin-bottom: 20px;
}

.wallet-info-badge .badge {
  color: #15803d;
  font-weight: 600;
}

.wallet-info-badge .balance {
  color: #166534;
}

.operation-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 10px 20px;
  font-size: 0.95rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  color: #3b82f6;
}

.tab-btn.active {
  color: #3b82f6;
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
}

.operation-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  color: #374151;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-input {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.balance-hint {
  font-size: 0.8rem;
  color: #64748b;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 10px;
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
  margin: 0;
}
</style>
