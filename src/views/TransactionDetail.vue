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
            <JvHashText :value="transaction.hash" type="tx" :truncate="12" :linkable="false" />
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <JvStatusTag :status="transaction.status === 'success' ? 'tx-success' : 'tx-failed'" />
          </div>
          <div class="info-item">
            <span class="label">区块</span>
            <JvHashText :value="String(transaction.blockNumber)" type="block" :truncate="0" />
          </div>
          <!-- v1 transactionInfos.html 有「区块哈希」行，可点进区块页 -->
          <div class="info-item">
            <span class="label">区块哈希</span>
            <JvHashText
              v-if="transaction.blockHash"
              :value="transaction.blockHash"
              type="block"
              :truncate="10"
            />
            <span v-else class="muted">待打包…</span>
          </div>
          <div class="info-item">
            <span class="label">确认数</span>
            <span v-if="confirmations !== null" class="value">{{ confirmations }} 个区块</span>
            <span v-else class="muted">—</span>
          </div>
          <div class="info-item">
            <span class="label">时间戳</span>
            <span class="value">{{ formatTimestamp(transaction.blockTimestamp) }} <span class="muted">(UTC) · {{ formatAge(transaction.blockTimestamp) }}</span></span>
          </div>
          <div class="info-item">
            <span class="label">发送方</span>
            <AddressWithLabel :address="transaction.from" :truncate="8" />
          </div>
          <div class="info-item">
            <span class="label">接收方</span>
            <AddressWithLabel v-if="transaction.to" :address="transaction.to" :truncate="8" />
            <span v-else class="value">合约创建</span>
          </div>
          <div class="info-item">
            <span class="label">发送金额</span>
            <JvAmount :value="transaction.value" unit="J" />
          </div>
          <!-- v1 双单位：{{gasPrice}} J (约 {{gasPriceGwei}} Gwei) -->
          <div class="info-item" v-if="gasPriceDual">
            <span class="label">Gas 价格</span>
            <span class="value">{{ gasPriceDual.j }} J <span class="muted">(约 {{ gasPriceDual.gwei }} Gwei)</span></span>
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
            <span class="label">交易手续费</span>
            <span v-if="txFeeDual" class="value">
              {{ txFeeDual.j }} J <span class="muted">(约 {{ txFeeDual.gwei }} Gwei)</span>
            </span>
            <span v-else class="muted">—</span>
          </div>
          <div class="info-item">
            <span class="label">随机数</span>
            <span class="value">{{ transaction.nonce }}</span>
          </div>
          <div class="info-item info-item--input">
            <span class="label">输入数据</span>
            <div class="value mono input-value">
              <span v-if="!transaction.input || transaction.input === '0x'" class="muted">无</span>
              <template v-else>
                <!-- ABI 解码视图（v1 可在「原始数据 ←→ ABI 解码」切换） -->
                <template v-if="inputMode === 'decoded' && decodedInput">
                  <div class="decoded">
                    <div class="decoded-head">
                      <span class="decoded-fn">{{ decodedInput.functionName }}<span class="decoded-sig">({{ decodedInput.argTypes }})</span></span>
                      <span class="decoded-by">{{ decodedInput.contractName }}</span>
                    </div>
                    <div v-for="(arg, i) in decodedInput.args" :key="i" class="decoded-arg">
                      <span class="decoded-arg-name">{{ arg.name || `#${i}` }}</span>
                      <span class="decoded-arg-type">{{ arg.type }}</span>
                      <span class="decoded-arg-value">{{ arg.value }}</span>
                    </div>
                    <div v-if="decodedInput.args.length === 0" class="muted">该函数无参数</div>
                  </div>
                </template>
                <span v-else class="input-text">{{ inputExpanded ? transaction.input : formatInput(transaction.input) }}</span>
                <span class="input-actions">
                  <button v-if="transaction.input.length > 50 && inputMode === 'raw'" class="input-btn" @click="inputExpanded = !inputExpanded">
                    {{ inputExpanded ? '收起' : '展开' }}
                  </button>
                  <!-- 只有解得出时才给切换按钮，否则点了变成「解不出」的空状态更让人困惑 -->
                  <button v-if="decodedInput" class="input-btn" @click="toggleInputMode">
                    {{ inputMode === 'raw' ? '尝试 ABI 解码' : '查看原始数据' }}
                  </button>
                  <button class="input-btn" @click="copyInput">
                    {{ copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制失败' : '复制' }}
                  </button>
                </span>
                <span v-if="copyState === 'error'" class="copy-hint">复制失败，请长按输入内容手动选择复制</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="error-section">
      <JvPageState
        type="network-error"
        title="交易未找到"
        :description="`找不到交易: ${txHash}`"
        action="返回首页"
        @action="$router.push('/')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onScopeDispose } from 'vue'
import { publicClient } from '../config/client'
import { formatNumber, formatAge } from '../utils/format'
import { toDualUnit, computeTxFee } from '../utils/amount-dual'
import { decodeInput } from '../utils/abi-decode'
import AddressWithLabel from '../components/AddressWithLabel.vue'
import { JvHashText, JvStatusTag, JvAmount, JvPageState } from '../design-system'

interface Props {
  hash: string
}

const props = defineProps<Props>()

const transaction = ref<any>(null)
const loading = ref(true)
const confirmations = ref<number | null>(null)
const txHash = ref(props.hash)
const inputExpanded = ref(false)
/** 输入数据展示模式：raw（原始 hex）/ decoded（ABI 解码）。v1 用 inputFormat 做同一件事 */
const inputMode = ref<'raw' | 'decoded'>('raw')
const copyState = ref<'idle' | 'copied' | 'error'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined

/** 重置 copyState 的定时器：保存 id，下次触发前先 clearTimeout，避免旧定时器把新状态提前重置 */
const scheduleCopyReset = (delayMs: number) => {
  if (copyTimer !== undefined) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copyState.value = 'idle'; copyTimer = undefined }, delayMs)
}

// 组件卸载时清理挂起的 copyTimer，避免卸载后定时器仍触发（与仓库 disposed/onScopeDispose 风格一致）
onScopeDispose(() => { if (copyTimer !== undefined) clearTimeout(copyTimer) })

const formatTimestamp = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC',
  })
}

// 交易手续费 = gasUsed × effectiveGasPrice（本链 Clique/PoA 非 1559，effectiveGasPrice 为 null 时回退 gasPrice）
const txFee = computed<bigint | null>(() => {
  const t = transaction.value
  if (!t) return null
  return computeTxFee(t.gasUsed ?? null, t.effectiveGasPrice ?? t.gasPrice ?? null)
})

// 双单位换算（v1 对 gasPrice / 手续费都给 J + Gwei 两档）
// gasPrice：保留小数（v1 用 parseInt 把 2.500000007 显示成 2，属呈现缺陷，不回退）
// 手续费：Gwei 档固定整数（真实值 610815.00171 Gwei 的小数位是 noise，v1 也是整数）
const gasPriceDual = computed(() => toDualUnit(transaction.value?.gasPrice ?? null))
const txFeeDual = computed(() => toDualUnit(txFee.value, { gweiMaxDecimals: 0 }))

// ABI 解码：只有解得出才暴露切换入口，解不出保持原始数据（与 v1 行为一致）
const decodedInput = computed(() => {
  const input = transaction.value?.input
  if (!input || input === '0x') return null
  return decodeInput(input)
})

const toggleInputMode = () => {
  inputMode.value = inputMode.value === 'raw' ? 'decoded' : 'raw'
}

const formatInput = (input: string): string => {
  if (!input || input === '0x') return '无'
  if (input.length <= 50) return input
  return `${input.substring(0, 50)}...`
}

const copyInput = async () => {
  if (!transaction.value?.input) return
  try {
    // 非 HTTPS 环境下 navigator.clipboard 可能为 undefined，需显式判空
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(transaction.value.input)
    copyState.value = 'copied'
    scheduleCopyReset(1500)
  } catch {
    // 剪贴板不可用（非 HTTPS / 权限被拒）：友好提示，不抛错、不白屏
    copyState.value = 'error'
    scheduleCopyReset(2500)
  }
}

const loadTransaction = async () => {
  loading.value = true
  try {
    // 并行拉交易 + 回执 + 最新区块高度（确认数 = 最新区块 - 交易区块 + 1，零额外串行延迟）
    const [txData, receipt, latestBlock] = await Promise.all([
      publicClient.getTransaction({ hash: props.hash as `0x${string}` }),
      publicClient.getTransactionReceipt({ hash: props.hash as `0x${string}` }),
      publicClient.getBlockNumber(),
    ])
    const block = await publicClient.getBlock({ blockNumber: txData.blockNumber! })
    // 区块哈希优先取回执里的（已确认）；未确认交易没有回执 blockHash，用 tx.blockHash
    transaction.value = {
      ...txData,
      ...receipt,
      blockHash: receipt.blockHash ?? txData.blockHash ?? null,
      blockTimestamp: block.timestamp,
    }
    if (receipt.blockNumber != null) {
      confirmations.value = Math.max(0, Number(latestBlock) - Number(receipt.blockNumber) + 1)
    }
  } catch (error) {
    console.error('Failed to fetch transaction:', error)
    transaction.value = null
    confirmations.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadTransaction() })
</script>

<style scoped>
.transaction-detail {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header { margin-bottom: 30px; }

.back-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-muted);
  border: none;
  padding: 8px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  margin-bottom: 20px;
  display: inline-block;
  transition: background var(--jv-duration-fast) var(--jv-ease);
}
.back-btn:hover { background: var(--jv-bg-hover); }

.header h1 { color: var(--jv-text-primary); margin: 0; }

.transaction-info { display: flex; flex-direction: column; gap: 30px; }

.info-section {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px;
}

.info-section h2 {
  color: var(--jv-text-primary);
  margin: 0 0 20px 0;
  font-size: 1.25rem;
}

.info-grid { display: grid; gap: 16px; }

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--jv-bg-subtle);
  border-radius: var(--jv-radius-md);
}

.info-item .label {
  color: var(--jv-text-muted);
  font-size: 0.9rem;
  min-width: 200px;
}

.info-item .value {
  color: var(--jv-text-primary);
  font-size: 0.9rem;
  word-break: break-all;
  max-width: 70%;
}

.info-item .value.mono {
  font-family: var(--jv-font-mono);
  color: var(--jv-text-secondary);
}

.muted { color: var(--jv-text-muted); font-size: 0.82rem; }

.input-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

/* 输入数据行：解码后内容可能多行，左侧标签顶部对齐更好读 */
.info-item--input { align-items: flex-start; }
.info-item--input .label { padding-top: 2px; }

.decoded {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--jv-font-mono);
  font-size: 0.82rem;
}

.decoded-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.decoded-fn {
  color: var(--jv-brand);
  font-weight: 600;
}

.decoded-sig { color: var(--jv-text-muted); font-weight: 400; }

.decoded-by {
  font-size: 0.75rem;
  color: var(--jv-text-muted);
  border: 1px solid var(--jv-border);
  border-radius: 999px;
  padding: 0 6px;
  font-family: inherit;
}

.decoded-arg {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.decoded-arg-name { color: var(--jv-text-secondary); }

.decoded-arg-type {
  color: var(--jv-text-muted);
  font-size: 0.75rem;
}

.decoded-arg-value {
  color: var(--jv-text-primary);
  word-break: break-all;
  text-align: right;
  max-width: 100%;
}

.input-text {
  font-family: var(--jv-font-mono);
  word-break: break-all;
  text-align: right;
}

.input-actions { display: flex; gap: 8px; }

.input-btn {
  background: none;
  border: 1px solid var(--jv-border);
  color: var(--jv-text-secondary);
  padding: 2px 8px;
  border-radius: var(--jv-radius-sm);
  cursor: pointer;
  font-size: 0.78rem;
  transition: border-color var(--jv-duration-fast) var(--jv-ease), color var(--jv-duration-fast) var(--jv-ease);
}
.input-btn:hover { border-color: var(--jv-brand); color: var(--jv-brand); }

.copy-hint {
  color: var(--jv-text-muted);
  font-size: 0.78rem;
  text-align: right;
}

.error-section {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 40px;
}
</style>
