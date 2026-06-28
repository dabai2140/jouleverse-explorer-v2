<template>
  <div class="address-detail">
    <div class="page-header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1>地址详情</h1>
    </div>

    <JvPageState
      v-if="error"
      type="network-error"
      :description="error"
      action="返回首页"
      @action="$router.push('/')"
    />

    <div v-else class="address-info">
      <!-- 地址信息 -->
      <div class="panel">
        <h2>📍 地址信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value address-formats" @click="cycleFormat" title="点击切换格式">
              <span class="format-badge">{{ formatLabel }}</span>
              {{ formatAddress(displayAddress) }}
            </span>
          </div>
          <div class="info-item all-formats">
            <span class="label">所有格式</span>
            <div class="format-list">
              <div class="format-row" @click="selectFormat('hex')" :class="{ active: inputFormat === 'hex' }">
                <span class="fmt-badge hex">HEX</span>
                <span class="fmt-value">{{ hexAddress }}</span>
              </div>
              <div class="format-row" @click="selectFormat('b32')" :class="{ active: inputFormat === 'b32' }">
                <span class="fmt-badge b32">B32</span>
                <span class="fmt-value">{{ b32Address }}</span>
              </div>
              <div class="format-row" @click="selectFormat('full')" :class="{ active: inputFormat === 'full' }">
                <span class="fmt-badge full">JVA</span>
                <span class="fmt-value">{{ fullAddress }}</span>
              </div>
            </div>
          </div>
          <div v-if="jnsName" class="info-item">
            <span class="label">JNS 域名</span>
            <span class="value jns-name">{{ jnsName }}.j</span>
          </div>
          <div class="info-item">
            <span class="label">能量余额</span>
            <JvAmount v-if="!loadingBalance && balance !== null" :value="balance" unit="J" />
            <span v-else class="value muted">{{ loadingBalance ? '加载中...' : '—' }}</span>
          </div>
        </div>
      </div>

      <!-- WJ 信息 -->
      <div class="panel">
        <h2>💰 Wrapped Joule (wJ)</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">wJ 余额</span>
            <JvAmount v-if="!loadingWJ && wjBalance !== null" :value="wjBalance" unit="wJ" />
            <span v-else class="value muted">{{ loadingWJ ? '加载中...' : '—' }}</span>
          </div>
          <div class="info-item">
            <span class="label">合约地址</span>
            <JvHashText :value="WJ_ADDRESS" type="address" :truncate="8" />
          </div>
        </div>
        <div class="info-note">
          <p>ℹ️ wJ 是 Joule 的 ERC20 代币包装版本。1 wJ = 1 J，可以自由转账。</p>
        </div>
        <WJOperations :address="hexAddress" :wjBalance="wjBalance" :formatAddress="formatAddress" :formatBalance="formatBalance" />
      </div>

      <!-- Core ID -->
      <div class="panel">
        <h2>🆔 Core ID 与签到</h2>
        <CoreIdSection :address="hexAddress" :formatAddress="formatAddress" />
      </div>

      <!-- JNS 持有 -->
      <div v-if="jnsTotal > 0 || loadingJnsHoldings" class="panel">
        <h2>🏷️ JNS 域名持有</h2>
        <JvLoading v-if="loadingJnsHoldings && jnsNames.length === 0" label="加载中..." />
        <div v-else>
          <p class="jns-summary">
            共持有 <strong>{{ jnsTotal }}</strong> 个 JNS 域名{{ jnsTotal > JNS_MAX_DISPLAY ? `，仅显示前 ${JNS_MAX_DISPLAY} 个` : '' }}
          </p>
          <div class="jns-list">
            <span v-for="name in jnsNames" :key="name" class="jns-tag">{{ name }}.j</span>
          </div>
          <div v-if="jnsLoaded < Math.min(jnsTotal, JNS_MAX_DISPLAY)" class="jns-more">
            <button class="btn-load-more" :disabled="loadingJnsHoldings" @click="loadMoreJns">
              {{ loadingJnsHoldings ? '加载中...' : `加载更多（已显示 ${jnsLoaded} / ${Math.min(jnsTotal, JNS_MAX_DISPLAY)}）` }}
            </button>
          </div>
          <p v-if="jnsTotal > JNS_MAX_DISPLAY" class="jns-overflow-hint">
            前往 <a @click.prevent="$router.push('/jns')" href="#">JNS 查询页</a> 可查看全部域名
          </p>
        </div>
      </div>

      <!-- 代币转账记录 -->
      <div class="panel">
        <h2>📜 代币转账记录</h2>
        <div class="tx-toolbar">
          <span v-if="txLogsLoaded && !txLoadError" class="tx-count">共 {{ totalTxs }} 条，第 {{ currentPage }} / {{ totalPages }} 页</span>
          <span v-else-if="txLoadError" class="tx-count error">加载失败</span>
          <span v-else class="tx-count muted">查询中...</span>
          <div class="pagination" v-if="totalPages > 1">
            <button @click="prevPage" :disabled="currentPage === 1 || loadingTxs" class="page-btn">←</button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="nextPage" :disabled="currentPage === totalPages || loadingTxs" class="page-btn">→</button>
          </div>
        </div>
        <p class="tx-scope-note">仅显示 ERC-20/ERC-721 代币转账（WJ、JNS、NFT 等），最近 200 万区块内记录；原生 J 转账暂不支持</p>

        <JvLoading v-if="loadingTxs" label="加载中..." />

        <div v-else-if="transactions.length > 0" class="tx-list">
          <div
            v-for="(tx, index) in transactions"
            :key="index"
            class="tx-card"
            @click="$router.push(`/tx/${tx.hash}`)"
          >
            <div class="tx-card-head">
              <div class="tx-hash-row">
                <span class="muted">交易哈希</span>
                <JvHashText :value="tx.hash" type="tx" :truncate="10" :linkable="false" />
              </div>
              <span class="muted">{{ tx.age }}</span>
            </div>
            <div class="tx-card-body">
              <div class="meta-row">
                <span class="muted">区块</span>
                <span>#{{ tx.blockNumber }}</span>
              </div>
              <div class="meta-row">
                <span class="muted">发送者</span>
                <JvHashText :value="tx.from" type="address" :truncate="8" :linkable="false" />
              </div>
              <div class="meta-row">
                <span class="muted">接收者</span>
                <JvHashText v-if="tx.to" :value="tx.to" type="address" :truncate="8" :linkable="false" />
                <span v-else class="muted">合约创建</span>
              </div>
            </div>
          </div>
        </div>

        <JvPageState
          v-else-if="txLogsLoaded"
          :type="txLoadError ? 'network-error' : 'empty'"
          :title="txLoadError ? '转账记录加载失败' : '暂无代币转账记录'"
          :description="txLoadError ? '请刷新页面重试' : '该地址在最近 200 万区块内无代币转账'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatEther } from 'viem'
import { WJ_ADDRESS, wjABI } from '../contracts/wj'
import { JNS_ADDRESS, jnsABI } from '../contracts/jns'
import WJOperations from './WJOperations.vue'
import CoreIdSection from './CoreIdSection.vue'
import { publicClient } from '../config/client'
import { encodeJVA, detectAddressFormat, normalizeToHex } from '../utils/jvaddress'
import { formatAge } from '../utils/format'
import { JvLoading, JvPageState, JvHashText, JvAmount } from '../design-system'

const router = useRouter()

interface Props { address: string }
const props = defineProps<Props>()

const error = ref<string | null>(null)
const inputFormat = ref<'hex' | 'b32' | 'full'>('hex')
const hexAddress = ref('')
const b32Address = ref('')
const fullAddress = ref('')

function initAddress(raw: string) {
  const format = detectAddressFormat(raw)
  if (format === 'unknown') { error.value = '无效的地址格式'; return false }
  inputFormat.value = format
  const hex = normalizeToHex(raw)
  if (!hex) { error.value = '地址格式无效'; return false }
  hexAddress.value = hex
  const encoded = encodeJVA(hex)
  if (encoded.success) { b32Address.value = encoded.b32Address; fullAddress.value = encoded.fullAddress }
  return true
}

const jnsName = ref<string | null>(null)
const JNS_BATCH_SIZE = 10
const JNS_MAX_DISPLAY = 50
const jnsTotal = ref(0)
const jnsNames = ref<string[]>([])
const jnsLoaded = ref(0)
const loadingJnsHoldings = ref(false)

const balance = ref<bigint | null>(null)
const wjBalance = ref<bigint | null>(null)
const loadingBalance = ref(true)
const loadingWJ = ref(true)

const TX_PAGE_SIZE = 20
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as `0x${string}`
const transactions = ref<any[]>([])
const loadingTxs = ref(false)
const currentPage = ref(1)
const totalTxs = ref(0)
const totalPages = ref(1)
const allTxLogs = ref<{ transactionHash: `0x${string}`; blockNumber: bigint }[]>([])
const txLogsLoaded = ref(false)
const txLoadError = ref(false)

const formatLabel = computed(() => ({ hex: 'HEX', b32: 'B32', full: 'JVA' }[inputFormat.value]))

const formatAddress = (addr: string): string => {
  if (!addr) return ''
  return `${addr.substring(0, 10)}...${addr.substring(addr.length - 8)}`
}

const displayAddress = computed(() => {
  if (inputFormat.value === 'hex') return hexAddress.value
  if (inputFormat.value === 'b32') return b32Address.value
  return fullAddress.value
})

initAddress(props.address)

function cycleFormat() {
  if (inputFormat.value === 'hex') inputFormat.value = 'b32'
  else if (inputFormat.value === 'b32') inputFormat.value = 'full'
  else inputFormat.value = 'hex'
}

function selectFormat(fmt: 'hex' | 'b32' | 'full') {
  inputFormat.value = fmt
  const addr = fmt === 'hex' ? hexAddress.value : fmt === 'b32' ? b32Address.value : fullAddress.value
  router.replace({ params: { ...router.currentRoute.value.params, address: addr } })
}

const formatBalance = (bal: bigint | null): string => {
  if (bal === null || bal === 0n) return '0'
  return parseFloat(formatEther(bal)).toFixed(4)
}


const loadBalance = async () => {
  loadingBalance.value = true
  try {
    balance.value = await publicClient.getBalance({ address: hexAddress.value as `0x${string}` })
  } catch { balance.value = null }
  finally { loadingBalance.value = false }
}

const loadWJBalance = async () => {
  loadingWJ.value = true
  try {
    wjBalance.value = await publicClient.readContract({ address: WJ_ADDRESS, abi: wjABI, functionName: 'balanceOf', args: [hexAddress.value as `0x${string}`] }) as bigint
  } catch { wjBalance.value = null }
  finally { loadingWJ.value = false }
}

const loadJnsName = async () => {
  try {
    const name = await publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: 'addr2name', args: [hexAddress.value as `0x${string}`] }) as string
    jnsName.value = name || null
  } catch { jnsName.value = null }
}

const loadJnsHoldings = async () => {
  loadingJnsHoldings.value = true
  try {
    const total = await publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: 'balanceOf', args: [hexAddress.value as `0x${string}`] }) as bigint
    jnsTotal.value = Number(total)
    if (jnsTotal.value === 0) return
    try {
      const end = Math.min(JNS_BATCH_SIZE, Math.min(jnsTotal.value, JNS_MAX_DISPLAY))
      const tokenIds = await Promise.all(
        Array.from({ length: end }, (_, i) => BigInt(i)).map(idx =>
          publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: 'tokenOfOwnerByIndex', args: [hexAddress.value as `0x${string}`, idx] }) as Promise<bigint>
        )
      )
      const names = await Promise.all(
        tokenIds.map(id => publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: '_allTokensName', args: [id] }) as Promise<string>)
      )
      jnsNames.value.push(...names)
      jnsLoaded.value = end
    } catch { }
  } catch { jnsTotal.value = 0 }
  finally { loadingJnsHoldings.value = false }
}

const loadMoreJns = async () => {
  if (loadingJnsHoldings.value) return
  loadingJnsHoldings.value = true
  try {
    const start = jnsLoaded.value
    const end = Math.min(start + JNS_BATCH_SIZE, Math.min(jnsTotal.value, JNS_MAX_DISPLAY))
    const tokenIds = await Promise.all(
      Array.from({ length: end - start }, (_, i) => BigInt(start + i)).map(idx =>
        publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: 'tokenOfOwnerByIndex', args: [hexAddress.value as `0x${string}`, idx] }) as Promise<bigint>
      )
    )
    const names = await Promise.all(
      tokenIds.map(id => publicClient.readContract({ address: JNS_ADDRESS, abi: jnsABI, functionName: '_allTokensName', args: [id] }) as Promise<string>)
    )
    jnsNames.value.push(...names)
    jnsLoaded.value = end
  } catch { }
  finally { loadingJnsHoldings.value = false }
}

const loadTransactions = async (page: number = 1) => {
  loadingTxs.value = true
  transactions.value = []
  try {
    if (!txLogsLoaded.value) {
      const addr = hexAddress.value.toLowerCase()
      const paddedAddr = ('0x' + '0'.repeat(24) + addr.slice(2)) as `0x${string}`
      // 分块查询，每块 100k 区块，避免 RPC block range 限制
      const CHUNK_SIZE = 100_000n
      const MAX_CHUNKS = 20 // 共扫描最近 2M 区块
      const latestBlock = await publicClient.getBlockNumber()
      const allRawLogs: any[] = []
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const toBlock = latestBlock - BigInt(i) * CHUNK_SIZE
        const fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n
        if (toBlock === 0n) break
        try {
          const [outChunk, inChunk] = await Promise.all([
            publicClient.getLogs({ topics: [TRANSFER_SIG, paddedAddr, null], fromBlock, toBlock } as any),
            publicClient.getLogs({ topics: [TRANSFER_SIG, null, paddedAddr], fromBlock, toBlock } as any),
          ])
          allRawLogs.push(...outChunk, ...inChunk)
        } catch {
          // 单块失败时跳过，继续向前扫描
        }
        if (fromBlock === 0n) break
      }
      const seen = new Set<string>()
      const combined = allRawLogs.filter(log => {
        if (seen.has(log.transactionHash)) return false
        seen.add(log.transactionHash)
        return true
      })
      combined.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
      allTxLogs.value = combined as { transactionHash: `0x${string}`; blockNumber: bigint }[]
      totalTxs.value = combined.length
      totalPages.value = Math.max(1, Math.ceil(combined.length / TX_PAGE_SIZE))
      txLogsLoaded.value = true
    }
    const start = (page - 1) * TX_PAGE_SIZE
    const pageLogs = allTxLogs.value.slice(start, start + TX_PAGE_SIZE)
    if (pageLogs.length === 0) return
    const uniqueBlockNums = [...new Set(pageLogs.map(l => l.blockNumber))]
    const [txDetails, blockList] = await Promise.all([
      Promise.all(pageLogs.map(log => publicClient.getTransaction({ hash: log.transactionHash }).catch(() => null))),
      Promise.all(uniqueBlockNums.map(bn => publicClient.getBlock({ blockNumber: bn }).catch(() => null))),
    ])
    const blockTimestamps = new Map<bigint, bigint>()
    blockList.forEach(b => { if (b) blockTimestamps.set(b.number!, b.timestamp) })
    transactions.value = txDetails
      .map((tx, i) => tx ? {
        hash: tx.hash, from: tx.from, to: tx.to, blockNumber: tx.blockNumber,
        age: formatAge(Number(blockTimestamps.get(pageLogs[i].blockNumber) ?? 0n)),
      } : null)
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)
  } catch {
    transactions.value = []
    txLoadError.value = true
    txLogsLoaded.value = true
    totalTxs.value = 0
    totalPages.value = 1
  } finally { loadingTxs.value = false }
}

const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; loadTransactions(currentPage.value) } }
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; loadTransactions(currentPage.value) } }

onMounted(() => {
  if (error.value) return
  loadBalance(); loadWJBalance(); loadJnsName(); loadJnsHoldings(); loadTransactions(1)
})
</script>

<style scoped>
.address-detail {
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

.address-info { display: flex; flex-direction: column; gap: 24px; }

/* ── Panel ── */
.panel {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 24px;
}

.panel h2 {
  color: var(--jv-text-primary);
  margin: 0 0 18px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

/* ── Info grid ── */
.info-grid { display: grid; gap: 12px; }

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  background: var(--jv-bg-subtle);
  border-radius: var(--jv-radius-md);
  gap: 12px;
}

.info-item .label {
  color: var(--jv-text-muted);
  font-size: 0.88rem;
  min-width: 120px;
  flex-shrink: 0;
}

.info-item .value {
  color: var(--jv-text-primary);
  font-size: 0.9rem;
  word-break: break-all;
  text-align: right;
}

.muted { color: var(--jv-text-muted); font-size: 0.85rem; }

/* ── Address format switcher ── */
.address-formats { cursor: pointer; }

.format-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--jv-radius-sm);
  margin-right: 6px;
  background: var(--jv-brand);
  color: #fff;
  vertical-align: middle;
}

.all-formats { flex-direction: column; align-items: flex-end; }

.format-list { display: flex; flex-direction: column; gap: 4px; width: 100%; align-items: flex-end; }

.format-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  font-size: 0.82rem;
  transition: background var(--jv-duration-fast) var(--jv-ease);
  width: 100%;
}

.format-row:hover { background: var(--jv-bg-hover); }

.format-row.active {
  background: var(--jv-brand-subtle);
  outline: 1px solid var(--jv-brand);
}

.fmt-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--jv-radius-sm);
  min-width: 34px;
  text-align: center;
  flex-shrink: 0;
}

.fmt-badge.hex { background: var(--jv-info-bg); color: var(--jv-info); }
.fmt-badge.b32 { background: var(--jv-success-bg); color: var(--jv-success); }
.fmt-badge.full { background: var(--jv-warning-bg); color: var(--jv-warning); }

.fmt-value {
  font-family: var(--jv-font-mono);
  color: var(--jv-text-secondary);
  word-break: break-all;
  font-size: 0.8rem;
}

/* ── JNS name ── */
.jns-name { font-weight: 600; color: var(--jv-brand); font-size: 1.05rem; }

.jns-summary {
  color: var(--jv-text-secondary);
  margin: 0 0 12px 0;
  font-size: 0.9rem;
}

.jns-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }

.jns-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--jv-radius-full);
  background: var(--jv-brand-subtle);
  color: var(--jv-brand);
  font-weight: 600;
  font-size: 0.88rem;
}

.btn-load-more {
  background: none;
  border: 1px solid var(--jv-border);
  color: var(--jv-text-secondary);
  padding: 6px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color var(--jv-duration-fast) var(--jv-ease),
              color var(--jv-duration-fast) var(--jv-ease);
}

.btn-load-more:hover:not(:disabled) { border-color: var(--jv-brand); color: var(--jv-brand); }
.btn-load-more:disabled { opacity: 0.5; cursor: not-allowed; }

.jns-overflow-hint {
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--jv-text-muted);
}

.jns-overflow-hint a {
  color: var(--jv-link);
  cursor: pointer;
  text-decoration: none;
}

.jns-overflow-hint a:hover { text-decoration: underline; }

/* ── Info note ── */
.info-note {
  margin-top: 14px;
  padding: 12px 14px;
  background: var(--jv-info-bg);
  border-radius: var(--jv-radius-md);
  border-left: 3px solid var(--jv-info);
}

.info-note p { margin: 0; color: var(--jv-info); font-size: 0.875rem; }

/* ── TX section ── */
.tx-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--jv-border);
}

.tx-count { font-size: 0.875rem; color: var(--jv-text-secondary); }
.tx-count.error { color: var(--jv-error); }

.tx-scope-note {
  font-size: 0.8rem;
  color: var(--jv-text-muted);
  margin: 0 0 16px 0;
}

.tx-list { display: flex; flex-direction: column; gap: 10px; }

.tx-card {
  padding: 14px 16px;
  background: var(--jv-bg-subtle);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  transition: background var(--jv-duration-fast) var(--jv-ease),
              border-color var(--jv-duration-fast) var(--jv-ease);
}

.tx-card:hover {
  background: var(--jv-brand-subtle);
  border-color: var(--jv-brand);
}

.tx-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tx-hash-row { display: flex; align-items: center; gap: 8px; }

.tx-card-body {
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

/* ── Pagination ── */
.pagination { display: flex; align-items: center; gap: 10px; }

.page-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-secondary);
  border: 1px solid var(--jv-border);
  padding: 5px 12px;
  border-radius: var(--jv-radius-md);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background var(--jv-duration-fast) var(--jv-ease);
}

.page-btn:hover:not(:disabled) { background: var(--jv-brand-subtle); border-color: var(--jv-brand); color: var(--jv-brand); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { color: var(--jv-text-muted); font-size: 0.85rem; }
</style>
