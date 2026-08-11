<template>
  <div class="pin-panel">
    <div class="pin-head">
      <h3>📌 重点关注</h3>
      <button class="pin-refresh" :disabled="loading" @click="load">
        {{ loading ? '读取中…' : '↻ 刷新' }}
      </button>
      <span v-if="updatedAt" class="pin-updated">更新于 {{ updatedAt }}</span>
    </div>

    <div class="pin-grid">
      <div v-for="item in items" :key="item.label" class="pin-item">
        <div class="pin-label">
          {{ item.label }}
          <span v-if="item.annotation" class="pin-ann" :title="item.annotation">{{ item.annotation }}</span>
        </div>
        <div v-if="item.error" class="pin-value pin-error">{{ item.error }}</div>
        <div v-else-if="item.cond" class="pin-value pin-cond" :class="item.condOk ? 'ok' : 'no'">
          {{ item.condOk ? item.condThen : item.condElse }}
        </div>
        <div v-else class="pin-value">{{ item.display }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getPublicClient } from '@wagmi/core'
import { formatUnits } from 'viem'
import { config } from '../stores/wallet'
import { evaluatePinExpr, extractPinRefs, type PinEnv, type PinValue } from '../utils/pinExpr'
import type { PinConfig, ToolboxContract } from '../contracts/toolbox'

const props = defineProps<{ contract: ToolboxContract }>()

const publicClient = getPublicClient(config)

interface PinItem {
  label: string
  annotation?: string
  display?: string
  error?: string
  cond?: boolean
  condOk?: boolean
  condThen?: string
  condElse?: string
}

const items = ref<PinItem[]>([])
const loading = ref(false)
const updatedAt = ref('')

// ---------- 依赖拓扑排序 ----------

function topoSort(pins: PinConfig[]): PinConfig[] {
  const byLabel = new Map(pins.map((p) => [p.label, p]))
  const visited = new Set<string>()
  const stack = new Set<string>()
  const order: PinConfig[] = []

  const refsOf = (p: PinConfig): string[] => {
    const refs = new Set<string>()
    for (const e of [...(p.args ?? []), p.expr ?? '', p.cond?.expr ?? '']) {
      for (const r of extractPinRefs(e)) refs.add(r)
    }
    return [...refs].filter((r) => byLabel.has(r))
  }

  const visit = (p: PinConfig) => {
    if (visited.has(p.label)) return
    if (stack.has(p.label)) {
      console.warn(`[PinPanel] 检测到循环依赖: ${p.label}`)
      return
    }
    stack.add(p.label)
    for (const r of refsOf(p)) {
      const dep = byLabel.get(r)
      if (dep) visit(dep)
    }
    stack.delete(p.label)
    visited.add(p.label)
    order.push(p)
  }

  for (const p of pins) visit(p)
  return order
}

// ---------- 链上值 → 表达式环境 ----------

function toEnvValue(v: unknown): PinValue {
  if (typeof v === 'bigint' || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.map(toEnvValue)
  if (v && typeof v === 'object') {
    const o: Record<string, PinValue> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (/^\d+$/.test(k)) continue // 跳过元组数字键
      o[k] = toEnvValue(val)
    }
    return o
  }
  return String(v)
}

// ---------- 展示格式化 ----------

function fmtValue(v: PinValue, format: PinConfig['format']): string {
  switch (format) {
    case 'number':
      return Number(v).toLocaleString('en-US')
    case 'percent':
      return `${Number(v).toFixed(2)}%`
    case 'j':
      return typeof v === 'bigint' ? formatUnits(v, 18) : String(v)
    case 'address':
      return typeof v === 'string' && v.startsWith('0x') && v.length > 12
        ? `${v.slice(0, 6)}…${v.slice(-4)}`
        : String(v)
    case 'timestamp': {
      const n = Number(v)
      if (!Number.isFinite(n) || n === 0) return String(v)
      return new Date(n * 1000).toLocaleString('zh-CN', { hour12: false })
    }
    case 'bool':
      return v === true || v === 'true' ? '✅' : '❌'
    case 'text':
      return String(v)
    case 'raw':
    default: {
      const fmt = (x: PinValue): unknown => {
        if (typeof x === 'bigint') return x.toString()
        if (Array.isArray(x)) return x.map(fmt)
        if (x && typeof x === 'object') {
          const o: Record<string, unknown> = {}
          for (const [k, val] of Object.entries(x as Record<string, PinValue>)) o[k] = fmt(val)
          return o
        }
        return x
      }
      return JSON.stringify(fmt(v))
    }
  }
}

// ---------- 参数转换（按 ABI 输入类型） ----------

function coerceArg(v: PinValue, type: string): unknown {
  if (type === 'bool') return v === true || v === 'true'
  if (type.startsWith('uint') || type.startsWith('int')) return BigInt(Math.trunc(Number(v)))
  if (type === 'address') return String(v) as `0x${string}`
  if (type === 'bytes' || type.startsWith('bytes')) return String(v) as `0x${string}`
  if (type.endsWith('[]')) return String(v)
  return String(v)
}

// ---------- 加载 ----------

// 收集 pin 的全部表达式（args / expr / cond），用于判断依赖
function pinExprs(p: { args?: string[]; expr?: string; cond?: { expr: string } }): string[] {
  return [
    ...(p.args ?? []),
    ...(p.expr ? [p.expr] : []),
    ...(p.cond?.expr ? [p.cond.expr] : []),
  ]
}

// 判断表达式是否引用了 env 中尚未计算的值（$v 是当前函数返回值，不算外部依赖）
function needsEnvFlush(p: { args?: string[]; expr?: string; cond?: { expr: string } }, env: PinEnv): boolean {
  for (const expr of pinExprs(p)) {
    const refs = expr.match(/\$([\w\u4e00-\u9fa5]+)/g) || []
    for (const ref of refs) {
      const name = ref.slice(1)
      if (name === 'v') continue
      if (!(name in env)) return true
    }
  }
  return false
}

async function load() {
  if (loading.value) return
  const pins = props.contract.pins
  if (!pins || pins.length === 0) return

  loading.value = true
  try {
    const ordered = topoSort(pins)
    const env: PinEnv = {}
    const abi = props.contract.abi
    const address = props.contract.address
    const results: PinItem[] = []

    // 波次聚合：无相互依赖的 fn pin 合并为一次 multicall
    let wave: { p: PinConfig; item: PinItem }[] = []

    const flushWave = async () => {
      if (wave.length === 0) return
      const calls = wave.map(({ p }) => {
        const fnDef = (abi as unknown as { name: string; inputs: { type: string }[] }[]).find(
          (x) => x.name === p.fn
        )
        if (!fnDef) throw new Error(`ABI 中无函数 ${p.fn}`)
        const args = (p.args ?? []).map((expr, i) => {
          const v = evaluatePinExpr(expr, env)
          return coerceArg(v, fnDef.inputs[i]?.type ?? 'string')
        })
        return {
          address,
          abi: abi as never,
          functionName: p.fn as never,
          args: args as never,
        }
      })
      // 同合约多调用聚合为 1 次 RPC（multicall3 2026-08-11 自部署）
      const res = await publicClient.multicall({ contracts: calls, allowFailure: true })
      wave.forEach(({ p, item }, i) => {
        const r = res[i]
        if (r.status === 'failure') {
          item.error = '调用失败'
          return
        }
        try {
          const raw = toEnvValue(r.result)
          const finalValue = p.expr
            ? evaluatePinExpr(p.expr, { ...env, v: raw })
            : raw
          env[p.label] = finalValue

          if (p.cond) {
            const condVal = evaluatePinExpr(p.cond.expr, env)
            item.cond = true
            item.condOk = condVal === true || condVal === 'true' || (typeof condVal === 'number' && condVal !== 0)
            item.condThen = p.cond.then
            item.condElse = p.cond.else
          } else {
            item.display = fmtValue(finalValue, p.format ?? 'raw')
          }
        } catch (e) {
          item.error = e instanceof Error ? e.message : String(e)
        }
      })
      wave = []
    }

    for (const p of ordered) {
      const item: PinItem = { label: p.label, annotation: p.annotation }
      try {
        if (p.fn) {
          // 参数/表达式依赖尚未计算的值 → 先 flush 当前波（保证依赖顺序）
          if (needsEnvFlush(p, env)) await flushWave()
          wave.push({ p, item })
        } else {
          // 纯计算 pin（无 RPC）：若依赖未计算的值同样先 flush
          if (needsEnvFlush(p, env)) await flushWave()
          const finalValue = p.expr
            ? evaluatePinExpr(p.expr, { ...env, v: '' })
            : ''
          env[p.label] = finalValue

          if (p.cond) {
            const condVal = evaluatePinExpr(p.cond.expr, env)
            item.cond = true
            item.condOk = condVal === true || condVal === 'true' || (typeof condVal === 'number' && condVal !== 0)
            item.condThen = p.cond.then
            item.condElse = p.cond.else
          } else {
            item.display = fmtValue(finalValue, p.format ?? 'raw')
          }
        }
      } catch (e) {
        item.error = e instanceof Error ? e.message : String(e)
      }
      results.push(item)
    }
    await flushWave()
    items.value = results
    updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.pin-panel {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 16px 20px;
  margin-bottom: 16px;
}

.pin-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.pin-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--jv-text-primary);
}

.pin-refresh {
  font-size: 0.75rem;
  padding: 3px 12px;
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-full);
  background: var(--jv-bg-subtle);
  color: var(--jv-text-secondary);
  cursor: pointer;
}

.pin-refresh:hover:not(:disabled) {
  border-color: var(--jv-brand);
  color: var(--jv-brand);
}

.pin-refresh:disabled {
  opacity: 0.6;
  cursor: wait;
}

.pin-updated {
  font-size: 0.72rem;
  color: var(--jv-text-muted);
}

.pin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.pin-item {
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  padding: 10px 14px;
  background: var(--jv-bg-subtle);
}

.pin-label {
  font-size: 0.78rem;
  color: var(--jv-text-secondary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pin-ann {
  font-size: 0.68rem;
  color: var(--jv-text-muted);
  cursor: help;
}

.pin-value {
  font-size: 1.05rem;
  font-weight: 600;
  font-family: var(--jv-font-mono);
  color: var(--jv-text-primary);
  word-break: break-all;
}

.pin-cond.ok {
  color: var(--jv-success);
}

.pin-cond.no {
  color: var(--jv-text-muted);
}

.pin-error {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--jv-error);
  font-family: var(--jv-font-mono);
}
</style>
