<script setup lang="ts">
// JNSVote 治理端面板：创建提案（多签流程）+ 待确认交易管理
// 仅对「多签签名人」（Koant/剪云为裳/明海云）展示；普通投票者看不到本面板。
// 流程：签名人填表 → submitProposal（自动成为首确认人）→ 其余签名人 confirm → 任一签名人 execute。

import { ref, computed, onMounted, watch } from 'vue'
import { NButton, NInput, NTag, NSpin, NDivider } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useWalletStore } from '../stores/wallet'
import { useJNSVoteGovernance, type PendingProposalTx } from '../composables/useJNSVoteGovernance'
import { publicClient } from '../config/client'
import { JvHashText } from '../design-system'

const walletStore = useWalletStore()
const message = useMessage()
const gov = useJNSVoteGovernance()

// 解构 ref，供模板顶层自动解包（gov 是普通对象，模板访问 gov.xxx 不会自动解包）
const { isSigner, pendingTxs, isLoading } = gov

// 表单
const form = ref({
  title: '',
  link: '',
  timeBegin: '',
  timeEnd: '',
})
const submitting = ref(false)

// 当前区块高度（用于提示起止区块合理值）
const currentBlock = ref(0n)

// 表单校验
const formValid = computed(() => {
  const tb = parseBlockHeight(form.value.timeBegin)
  const te = parseBlockHeight(form.value.timeEnd)
  return (
    form.value.title.trim().length > 0 &&
    tb !== null &&
    te !== null &&
    te > tb
  )
})

function parseBlockHeight(s: string): bigint | null {
  const t = s.trim()
  if (!/^\d+$/.test(t)) return null
  try {
    return BigInt(t)
  } catch {
    return null
  }
}

async function refresh() {
  if (!walletStore.address) return
  await gov.loadGovernance(walletStore.address)
}

async function handleSubmit() {
  if (!formValid.value || !walletStore.address) return
  submitting.value = true
  try {
    const txId = await gov.submitProposal({
      title: form.value.title.trim(),
      link: form.value.link.trim(),
      timeBegin: parseBlockHeight(form.value.timeBegin)!,
      timeEnd: parseBlockHeight(form.value.timeEnd)!,
    })
    if (txId >= 0) {
      message.success(`已提交多签交易 #${txId}（您已自动确认），等待其他签名人确认`)
    } else {
      message.success('已提交多签交易，请刷新查看')
    }
    form.value = { title: '', link: '', timeBegin: '', timeEnd: '' }
    await refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

async function handleConfirm(tx: PendingProposalTx) {
  try {
    await gov.confirmTx(tx.txId)
    message.success(`已确认交易 #${tx.txId}`)
    await refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  }
}

async function handleExecute(tx: PendingProposalTx) {
  try {
    await gov.executeTx(tx.txId)
    message.success(`已执行交易 #${tx.txId}，提案已创建`)
    await refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  }
}

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

// 地址 → 显示名（签名人身份）
const SIGNER_NAMES: Record<string, string> = {
  '0x5bf50f2931688f886f46f88d5ceede530bb92076': 'Koant (J-0)',
  '0xe369810b1b07d0b82f702667429c3842905c14ff': '剪云为裳 (J-37)',
  '0xf66082f48cbc11ac83cdde11644f4db2f363205a': '明海云 (J-7)',
}
function signerName(a: string): string {
  return SIGNER_NAMES[a.toLowerCase()] ?? shortAddr(a)
}

onMounted(async () => {
  try {
    currentBlock.value = await publicClient.getBlockNumber()
  } catch { /* 忽略，仅用于提示 */ }
  await refresh()
})

watch(
  () => walletStore.address,
  (addr) => {
    if (addr) refresh()
  },
)
</script>

<template>
  <div v-if="isSigner" class="gov-panel">
    <NDivider title-placement="left">🛡️ 治理端（多签签名人专属）</NDivider>

    <NSpin :show="isLoading">
      <!-- 创建提案表单 -->
      <div class="gov-form">
        <h3 class="gov-form-title">📝 创建新提案</h3>
        <div class="gov-form-row">
          <label class="gov-label">提案标题 *</label>
          <NInput v-model:value="form.title" placeholder="例如：批准 X 项治理决议" />
        </div>
        <div class="gov-form-row">
          <label class="gov-label">提案详情链接</label>
          <NInput v-model:value="form.link" placeholder="https://…（可选，指向完整提案文档）" />
        </div>
        <div class="gov-form-row">
          <label class="gov-label">开始区块 *</label>
          <NInput v-model:value="form.timeBegin" placeholder="如 8600000（须 > 当前区块）" />
        </div>
        <div class="gov-form-row">
          <label class="gov-label">结束区块 *</label>
          <NInput v-model:value="form.timeEnd" placeholder="如 8800000（须 > 开始区块）" />
        </div>
        <div v-if="currentBlock > 0n" class="gov-form-hint">
          当前区块：{{ currentBlock.toString() }}（约 15s/块）
        </div>
        <NButton
          type="primary"
          :disabled="!formValid || submitting"
          :loading="submitting"
          @click="handleSubmit"
        >
          提交创建（成为首确认人）
        </NButton>
      </div>

      <!-- 待确认交易列表 -->
      <div class="gov-pending">
        <h3 class="gov-form-title">⏳ 待确认的多签交易（{{ pendingTxs.length }}）</h3>
        <div v-if="pendingTxs.length === 0" class="gov-empty">
          暂无待执行的多签交易
        </div>
        <div v-for="tx in pendingTxs" :key="tx.txId" class="gov-tx">
          <div class="gov-tx-head">
            <span class="gov-tx-id">#{{ tx.txId }}</span>
            <NTag size="small" :type="tx.confirmed ? 'success' : 'warning'">
              {{ tx.confirmed ? `${tx.confirmationCount}/${tx.required} 已确认` : `${tx.confirmationCount}/${tx.required} 确认中` }}
            </NTag>
          </div>
          <div v-if="tx.title" class="gov-tx-title">{{ tx.title }}</div>
          <div class="gov-tx-meta">
            目标：<JvHashText :value="tx.destination" type="address" :truncate="12" />
            <span v-if="tx.title">｜区块 {{ tx.timeBegin.toString() }} → {{ tx.timeEnd.toString() }}</span>
          </div>
          <div class="gov-tx-confirmers">
            已确认：<span v-for="c in tx.confirmations" :key="c" class="gov-signer">{{ signerName(c) }}</span>
          </div>
          <div class="gov-tx-actions">
            <NButton
              v-if="!tx.confirmed"
              size="small"
              type="primary"
              ghost
              @click="handleConfirm(tx)"
            >
              确认
            </NButton>
            <NButton
              v-if="tx.confirmed"
              size="small"
              type="success"
              @click="handleExecute(tx)"
            >
              执行（创建提案）
            </NButton>
          </div>
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.gov-panel {
  margin: 20px 0;
  padding: 16px 18px;
  border: 1px solid var(--jv-border, #e5e5e5);
  border-radius: 12px;
  background: var(--jv-bg-surface, #fff);
}
.gov-form-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.gov-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.gov-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gov-label {
  font-size: 13px;
  color: var(--jv-text-secondary, #475569);
}
.gov-form-hint {
  font-size: 12px;
  color: var(--jv-text-muted, #64748b);
}
.gov-pending {
  border-top: 1px solid var(--jv-border, #e5e5e5);
  padding-top: 16px;
}
.gov-empty {
  font-size: 13px;
  color: var(--jv-text-muted, #64748b);
}
.gov-tx {
  border: 1px solid var(--jv-border, #e5e5e5);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.gov-tx-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.gov-tx-id {
  font-weight: 700;
  color: var(--jv-success, #16a34a);
}
.gov-tx-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.gov-tx-meta {
  font-size: 12px;
  color: var(--jv-text-secondary, #475569);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gov-tx-confirmers {
  font-size: 12px;
  color: var(--jv-text-secondary, #475569);
  margin: 6px 0;
}
.gov-signer {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--jv-bg-subtle, #f1f5f9);
}
.gov-tx-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
