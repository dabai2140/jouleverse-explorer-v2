<template>
  <div class="merkle-tool-view">
    <div class="back-row">
      <router-link to="/tools" class="back-link">← 返回工具集</router-link>
    </div>

    <div class="merkle-header">
      <h1>🎁 Merkle Proof 生成工具</h1>
      <p>用于 Joule 空投的 Merkle Tree 生成和验证（incentive 格式数据）</p>
      <n-tag
        size="small"
        :type="rpcStatus === 'connected' ? 'success' : rpcStatus === 'error' ? 'error' : 'default'"
        class="rpc-tag"
      >
        {{ rpcStatus === 'connected' ? '✅ 已连接 Jouleverse' : rpcStatus === 'error' ? '❌ RPC 连接失败' : '⏳ 连接 RPC...' }}
      </n-tag>
    </div>

    <div class="merkle-content">
      <!-- 左：输入区域 -->
      <section class="merkle-panel">
        <h2 class="panel-title">📤 输入空投数据</h2>

        <n-tabs v-model:value="activeTab" type="line" size="small" class="input-tabs">
          <n-tab-pane name="paste" tab="粘贴 JSON">
            <n-input
              v-model:value="jsonInput"
              type="textarea"
              :rows="12"
              placeholder="粘贴 incentive 格式空投数据，例如：&#10;const incentive202408 = { 'total': 41, 'sum': 12000000, 'list': [&#10;  ['Koant', 'J0', 'bit.j', 'J3哪弯赏医堆伴桂惜楚晋稀陷碧午浇P0QXD', 660900],&#10;  ['Jacky', 'J9', '', 'J3备际何郭颗尼叹即常击园祝谓摘参ZZAGJ', 76400]&#10;] }"
              :disabled="processing"
            />
          </n-tab-pane>
          <n-tab-pane name="upload" tab="上传文件">
            <div class="file-upload" @click="triggerFileSelect">
              <div class="file-upload-icon">📄</div>
              <p class="file-upload-title">点击选择 JSON 文件</p>
              <p class="file-upload-hint">支持 .json 格式文件</p>
              <input ref="fileInputRef" type="file" accept=".json" class="file-input-hidden" @change="handleFileUpload" />
            </div>
            <p v-if="fileName" class="file-name">已选择：{{ fileName }}</p>
          </n-tab-pane>
        </n-tabs>

        <div class="btn-group">
          <n-button type="primary" :loading="processing" :disabled="processing" @click="processData">
            ⚡ 验证并生成
          </n-button>
          <n-button secondary :disabled="processing" @click="clearAll">清空</n-button>
        </div>

        <div v-if="processing" class="processing-box">
          <div class="spinner"></div>
          <p class="processing-text">{{ processingText }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
        </div>
      </section>

      <!-- 右：结果区域 -->
      <section class="merkle-panel">
        <h2 class="panel-title">📊 验证结果</h2>

        <div v-if="statistics" class="statistics">
          <div class="stat-item">
            <div class="stat-label">总地址数</div>
            <div class="stat-value">{{ statistics.totalAddresses }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">总 Joule 数</div>
            <div class="stat-value">{{ statistics.totalJoule.toLocaleString() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">一致性通过</div>
            <div class="stat-value">{{ statistics.validCount }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">警告 / 错误</div>
            <div class="stat-value stat-warn">{{ statistics.warnings }} / {{ statistics.errors }}</div>
          </div>
        </div>

        <div class="result-items">
          <div
            v-for="item in resultItems"
            :key="item.id"
            class="result-item"
            :class="`is-${item.type}`"
          >
            <div class="result-title">{{ item.icon }} {{ item.title }}</div>
            <div v-if="item.message" class="result-value">{{ item.message }}</div>
          </div>
        </div>

        <div v-if="merkleRoot" class="root-section">
          <div class="result-item is-success">
            <div class="result-title">✅ Merkle Root</div>
            <div class="result-value mono">{{ merkleRoot }}</div>
          </div>
          <n-button size="small" quaternary class="copy-btn" @click="copyRoot">📋 复制</n-button>
        </div>

        <n-alert v-if="warningsBox.length" type="warning" class="warn-box" :show-icon="true">
          <template #header>⚠️ 警告（{{ warningsBox.length }} 条）</template>
          <ul class="warn-list">
            <li v-for="(w, i) in warningsBox" :key="i">{{ w }}</li>
          </ul>
        </n-alert>

        <div v-if="merkleRoot" class="download-section">
          <h3>📥 下载生成的文件</h3>
          <div class="btn-group">
            <n-button size="small" @click="downloadFile('merkle-root.txt')">📄 下载 Merkle Root</n-button>
            <n-button size="small" @click="downloadFile('merkle-proofs.json')">🗂️ 下载 Merkle Proofs</n-button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { publicClient } from '../config/client'
import { JVCORE_ADDRESS, jvcoreABI } from '../contracts/jvcore'
import { JNS_ADDRESS, jnsABI } from '../contracts/jns'
import { decodeJVA } from '../utils/jvaddress'
import { buildStandardMerkleTree, type Hex } from '../utils/merkleTree'

type ResultType = 'info' | 'success' | 'warning' | 'error'

interface ResultItem {
  id: string
  title: string
  message: string
  type: ResultType
  icon: string
}

interface ToolStatistics {
  totalAddresses: number
  totalJoule: number
  validCount: number
  warnings: number
  errors: number
}

interface ProcessedRow {
  nickname: string
  coreId: string
  jnsDomain: string
  jvaAddress: string
  jouleAmount: number
  hexAddress: string
  coreAddress: string | null
  jnsAddress: string | null
  isConsistent: boolean
}

interface MerkleProofEntry {
  index: number
  amount: string
  proof: Hex[]
  hexAddress: string
  coreId: string
  nickname: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const CHAIN_LOOKUP_CONCURRENCY = 6

const message = useMessage()

// ---------- 状态 ----------
const activeTab = ref<'paste' | 'upload'>('paste')
const jsonInput = ref('')
const fileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const processing = ref(false)
const processingText = ref('正在验证数据并生成 Merkle Proof...')
const progress = ref(0)
const rpcStatus = ref<'checking' | 'connected' | 'error'>('checking')
const merkleRoot = ref('')
const statistics = ref<ToolStatistics | null>(null)
const warningsBox = ref<string[]>([])
let merkleProofs: Record<string, MerkleProofEntry> = {}

function initialItems(): ResultItem[] {
  return [
    { id: 'json', title: 'JSON 解析状态：', message: '等待输入', type: 'info', icon: 'ℹ️' },
    { id: 'total', title: '数量检查：', message: '等待检查', type: 'info', icon: 'ℹ️' },
    { id: 'address', title: '地址一致性检查：', message: '等待检查', type: 'info', icon: 'ℹ️' },
    { id: 'merkle', title: 'Merkle Tree 生成：', message: '等待生成', type: 'info', icon: 'ℹ️' },
  ]
}
const resultItems = ref<ResultItem[]>(initialItems())

function updateItem(id: string, title: string, content: string, type: ResultType) {
  const item = resultItems.value.find((i) => i.id === id)
  if (!item) return
  item.title = title
  item.message = content
  item.type = type
  item.icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'
}

// ---------- 输入 ----------
function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    jsonInput.value = String(reader.result ?? '')
    activeTab.value = 'paste'
  }
  reader.readAsText(file)
}

// ---------- 解析（兼容 const incentive202408 = {...} 风格） ----------
function parseAirdropInput(input: string): unknown {
  const trimmed = input.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fallthrough：尝试 JS 对象风格
  }
  const match = trimmed.match(/const\s+\w+\s*=\s*(\{[\s\S]*\})/)
  let source = match ? match[1]! : trimmed
  source = source.replace(/'/g, '"') // 单引号 → 双引号
  source = source.replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // 补键引号
  source = source.replace(/,\s*([}\]])/g, '$1') // 去尾逗号
  return JSON.parse(source)
}

// ---------- 链上解析（限并发，保护小型公共节点） ----------
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i]!, i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function shortError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string }
  return e?.shortMessage ?? e?.message ?? String(err)
}

interface RowResolution {
  row?: ProcessedRow
  warnings: string[]
  fatal?: string
}

async function resolveRow(item: unknown[]): Promise<RowResolution> {
  const warnings: string[] = []
  const nickname = String(item[0] ?? '')
  const coreId = String(item[1] ?? '')
  const jnsDomain = String(item[2] ?? '')
  const jvaAddress = String(item[3] ?? '')
  const rawAmount = item[4]

  if (!coreId.startsWith('J')) {
    return { warnings, fatal: `Core ID 格式错误: ${coreId}` }
  }

  const jouleAmount =
    typeof rawAmount === 'number'
      ? rawAmount
      : typeof rawAmount === 'string' && rawAmount.trim() !== ''
        ? Number(rawAmount)
        : NaN
  if (!Number.isFinite(jouleAmount) || jouleAmount <= 0) {
    return { warnings, fatal: `无效的 Joule 数量: ${String(rawAmount)}` }
  }

  const decoded = decodeJVA(jvaAddress)
  if (!decoded.success) {
    return { warnings, fatal: `JVA 解码失败: ${decoded.error}` }
  }
  const hexAddress = decoded.hexAddress.toLowerCase()

  // 链上查询（并行，失败仅记警告）
  const tokenId = Number(coreId.substring(1))
  const name = jnsDomain.trim().replace(/\.j$/i, '')

  const [coreRes, jnsRes] = await Promise.allSettled([
    Number.isFinite(tokenId)
      ? publicClient.readContract({
          address: JVCORE_ADDRESS,
          abi: jvcoreABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        })
      : Promise.reject(new Error('无效的 Core ID')),
    name
      ? publicClient.readContract({
          address: JNS_ADDRESS,
          abi: jnsABI,
          functionName: 'name2addr',
          args: [name],
        })
      : Promise.resolve(null),
  ])

  let coreAddress: string | null = null
  if (coreRes.status === 'fulfilled') {
    coreAddress = coreRes.value.toLowerCase()
  } else {
    warnings.push(`${nickname} (${coreId})：无法查询 Core ID 地址 — ${shortError(coreRes.reason)}`)
  }

  let jnsAddress: string | null = null
  if (!name) {
    warnings.push(`${nickname} (${coreId})：JNS 域名缺失（允许）`)
  } else if (jnsRes.status === 'fulfilled' && jnsRes.value) {
    const resolved = jnsRes.value.toLowerCase()
    if (resolved === ZERO_ADDRESS) {
      warnings.push(`${nickname} (${coreId})：JNS 域名 ${jnsDomain} 未绑定地址`)
    } else {
      jnsAddress = resolved
    }
  } else if (jnsRes.status === 'rejected') {
    warnings.push(`${nickname} (${coreId})：无法查询 JNS 地址 — ${shortError(jnsRes.reason)}`)
  }

  // 一致性检查
  const rowWarnings: string[] = []
  let isConsistent = true
  if (coreAddress && coreAddress !== hexAddress) {
    rowWarnings.push('Core ID 地址与空投地址不一致')
    isConsistent = false
  }
  if (jnsAddress && jnsAddress !== hexAddress) {
    rowWarnings.push('JNS 地址与空投地址不一致')
    isConsistent = false
  }
  if (!coreAddress && !jnsAddress) {
    rowWarnings.push('无法验证地址，使用 JVA 地址')
  }
  for (const w of rowWarnings) {
    warnings.push(`${nickname} (${coreId})：${w}`)
  }

  return {
    warnings,
    row: {
      nickname,
      coreId,
      jnsDomain,
      jvaAddress,
      jouleAmount,
      hexAddress,
      coreAddress,
      jnsAddress,
      isConsistent,
    },
  }
}

// ---------- 主流程 ----------
async function processData() {
  if (processing.value) return
  clearResults()
  processing.value = true
  processingText.value = '正在验证数据并生成 Merkle Proof...'
  progress.value = 5

  try {
    // 1. 解析
    updateItem('json', 'JSON 解析状态：', '解析中...', 'info')
    const input = jsonInput.value.trim()
    if (!input) throw new Error('请输入 JSON 数据')
    const parsed = parseAirdropInput(input)
    progress.value = 15
    updateItem('json', 'JSON 解析状态：', '✅ 解析成功', 'success')

    // 2. 结构校验
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JSON 顶层必须是对象')
    }
    const data = parsed as Record<string, unknown>
    if (!data.total || !data.sum || !Array.isArray(data.list)) {
      throw new Error('数据格式错误：缺少 total、sum 或 list 字段')
    }
    const total = Number(data.total)
    const sum = Number(data.sum)
    const list = data.list as unknown[][]

    progress.value = 20
    updateItem('address', '地址一致性检查：', '验证中（链上查询 Core ID / JNS）...', 'info')

    // 3. 逐行处理（限并发，避免 RPC 限速）
    const processedRows: ProcessedRow[] = []
    const warnings: string[] = []
    let errors = 0
    const results = await mapLimit(list, CHAIN_LOOKUP_CONCURRENCY, (item) => resolveRow(item))
    results.forEach((res, i) => {
      for (const w of res.warnings) warnings.push(w)
      if (res.fatal) {
        warnings.push(`第 ${i + 1} 行处理失败: ${res.fatal}`)
        errors++
        return
      }
      if (res.row) processedRows.push(res.row)
    })
    progress.value = 70

    // 4. 数量检查
    const sumValid = processedRows.reduce((acc, r) => acc + r.jouleAmount, 0)
    const totalMsgs: string[] = []
    let totalType: ResultType = 'success'
    if (processedRows.length === total) {
      totalMsgs.push(`✅ 地址总数一致: ${processedRows.length}`)
    } else {
      totalMsgs.push(`❌ 地址总数不一致: 预期 ${total}，实际 ${processedRows.length}`)
      totalType = 'error'
      errors++
    }
    if (sumValid === sum) {
      totalMsgs.push(`✅ Joule 总数一致: ${sumValid.toLocaleString()}`)
    } else {
      totalMsgs.push(`❌ Joule 总数不一致: 预期 ${sum.toLocaleString()}，实际 ${sumValid.toLocaleString()}`)
      totalType = 'error'
      errors++
    }
    updateItem('total', '数量检查：', totalMsgs.join('\n'), totalType)
    progress.value = 80

    // 5. 统计
    statistics.value = {
      totalAddresses: processedRows.length,
      totalJoule: sumValid,
      validCount: processedRows.filter((r) => r.isConsistent).length,
      warnings: warnings.length,
      errors,
    }
    warningsBox.value = warnings

    // 6. 生成 Merkle Tree + Proofs
    updateItem('merkle', 'Merkle Tree 生成：', '生成中...', 'info')
    const leafValues = processedRows.map((r) => [r.hexAddress, r.jouleAmount.toString()] as const)
    const tree = buildStandardMerkleTree(leafValues, ['address', 'uint256'])
    merkleRoot.value = tree.root
    merkleProofs = {}
    processedRows.forEach((r, i) => {
      merkleProofs[r.hexAddress] = {
        index: i,
        amount: r.jouleAmount.toString(),
        proof: tree.getProof(i),
        hexAddress: r.hexAddress,
        coreId: r.coreId,
        nickname: r.nickname,
      }
    })
    updateItem('merkle', 'Merkle Tree 生成：', `✅ 生成成功，共 ${tree.leafCount} 个地址`, 'success')
    progress.value = 100
    processingText.value = '完成'
  } catch (e) {
    updateItem('json', '处理状态：', `❌ ${(e as Error).message}`, 'error')
  } finally {
    processing.value = false
  }
}

// ---------- 下载 / 复制 / 清空 ----------
function downloadFile(filename: string) {
  if (!merkleRoot.value) return
  let content = merkleRoot.value
  let type = 'text/plain'
  if (filename === 'merkle-proofs.json') {
    type = 'application/json'
    content = JSON.stringify(
      {
        merkleRoot: merkleRoot.value,
        generationTime: new Date().toISOString(),
        totalAddresses: statistics.value?.totalAddresses ?? 0,
        totalJoule: statistics.value?.totalJoule ?? 0,
        proofs: merkleProofs,
      },
      null,
      2,
    )
  }
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyRoot() {
  if (!merkleRoot.value) return
  try {
    await navigator.clipboard.writeText(merkleRoot.value)
    message.success('已复制 Merkle Root')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

function clearResults() {
  merkleRoot.value = ''
  statistics.value = null
  warningsBox.value = []
  merkleProofs = {}
  resultItems.value = initialItems()
  progress.value = 0
}

function clearAll() {
  jsonInput.value = ''
  fileName.value = ''
  activeTab.value = 'paste'
  processing.value = false
  clearResults()
}

onMounted(async () => {
  try {
    await publicClient.getChainId()
    rpcStatus.value = 'connected'
  } catch {
    rpcStatus.value = 'error'
  }
})
</script>

<style scoped>
.merkle-tool-view {
  min-height: 60vh;
}

.back-row {
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px 24px 0;
}

.back-link {
  color: var(--jv-link);
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  color: var(--jv-link-hover);
  text-decoration: underline;
}

.merkle-header {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 24px 4px;
}

.merkle-header h1 {
  margin: 0 0 6px 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--jv-text-primary);
}

.merkle-header p {
  margin: 0 0 10px 0;
  font-size: 0.92rem;
  color: var(--jv-text-secondary);
}

.rpc-tag {
  margin-bottom: 4px;
}

.merkle-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 24px 40px;
}

@media (max-width: 900px) {
  .merkle-content {
    grid-template-columns: 1fr;
  }
}

.merkle-panel {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px 22px;
}

.panel-title {
  margin: 0 0 16px 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--jv-text-primary);
  padding-bottom: 10px;
  border-bottom: 2px solid var(--jv-brand-subtle);
}

.input-tabs {
  margin-bottom: 8px;
}

.file-upload {
  padding: 28px 20px;
  border: 2px dashed var(--jv-border);
  border-radius: var(--jv-radius-lg);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--jv-duration-fast) var(--jv-ease), background var(--jv-duration-fast) var(--jv-ease);
}

.file-upload:hover {
  border-color: var(--jv-brand);
  background: var(--jv-brand-subtle);
}

.file-upload-icon {
  font-size: 2.2rem;
  margin-bottom: 8px;
}

.file-upload-title {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: var(--jv-brand);
}

.file-upload-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--jv-text-muted);
}

.file-input-hidden {
  display: none;
}

.file-name {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: var(--jv-text-secondary);
  text-align: center;
}

.btn-group {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.processing-box {
  margin-top: 16px;
  text-align: center;
  padding: 16px 10px;
  border-radius: var(--jv-radius-md);
  background: var(--jv-bg-subtle);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--jv-border);
  border-top-color: var(--jv-brand);
  border-radius: 50%;
  animation: merkle-spin 0.9s linear infinite;
  margin: 0 auto 10px;
}

@keyframes merkle-spin {
  to {
    transform: rotate(360deg);
  }
}

.processing-text {
  margin: 0 0 10px;
  font-size: 0.88rem;
  color: var(--jv-text-secondary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--jv-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jv-brand), var(--jv-brand-hover, var(--jv-brand)));
  width: 0%;
  transition: width 0.25s ease;
}

.statistics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  background: var(--jv-bg-subtle);
  padding: 12px 10px;
  border-radius: var(--jv-radius-md);
  text-align: center;
}

.stat-label {
  font-size: 0.78rem;
  color: var(--jv-text-muted);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--jv-brand);
  margin-top: 4px;
  word-break: break-word;
}

.stat-warn {
  color: var(--jv-warning);
  font-size: 1.05rem;
}

.result-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  padding: 10px 12px;
  border-radius: var(--jv-radius-md);
  background: var(--jv-bg-subtle);
  border-left: 4px solid var(--jv-text-muted);
}

.result-item.is-success {
  border-left-color: var(--jv-success);
}

.result-item.is-warning {
  border-left-color: var(--jv-warning);
}

.result-item.is-error {
  border-left-color: var(--jv-error, #d03050);
}

.result-title {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--jv-text-primary);
}

.result-value {
  margin-top: 5px;
  font-size: 0.83rem;
  color: var(--jv-text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
  background: var(--jv-bg-surface);
  padding: 8px;
  border-radius: var(--jv-radius-sm);
}

.result-value.mono,
.mono {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}

.root-section {
  margin-top: 14px;
  position: relative;
}

.copy-btn {
  margin-top: 8px;
}

.warn-box {
  margin-top: 16px;
}

.warn-list {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 0.83rem;
  max-height: 180px;
  overflow-y: auto;
}

.download-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--jv-border);
}

.download-section h3 {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  color: var(--jv-text-primary);
}
</style>
