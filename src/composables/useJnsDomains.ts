// JNS 域名总览数据层：整集枚举（ERC721Enumerable，只读）
// 策略（链上实测，scripts/smoke-jns-domains.mjs 同口径）：
//   totalSupply() = 已发行总数；tokenByIndex(i) 全程可用（i ∈ [0, totalSupply-1]，
//   越界 revert "ERC721Enumerable: global index out of bounds"）；
//   tokenId 自 1 连续递增 ⇒ 注册越晚 tokenId 越大 ⇒ 页面从尾部（最新）往前枚举。
// RPC 负担（遵守零负担原则）：所有读取经 multicall3 聚合，单请求子调用数封顶
//   MULTICALL_CHUNK（链上实测 300 稳定）；首屏一页 PAGE_SIZE 条，加载更多同粒度，
//   「加载全部」按 CHUNK 分段逐段更新（进度可见，不一次性打满）。

import { ref, computed, onScopeDispose } from 'vue'
import { publicClient } from '../config/client'
import { JNS_ADDRESS, jnsABI } from '../contracts/jns'
import { safeErrorMessage } from '../utils/error'
export interface JnsDomainEntry {
  tokenId: number
  name: string
  owner: string
  boundAddress: string
  isBound: boolean
  /** _bound 读取是否失败（失败 ≠ 未绑定，UI 需显式提示「未知」） */
  boundUnknown: boolean
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** 单个 multicall 请求内聚合的最大子调用数（链上实测 300 稳定） */
const MULTICALL_CHUNK = 300
/** 首屏 / 「加载更多」每页域名数 */
export const JNS_DOMAINS_PAGE_SIZE = 120

// jns.ts 的 ABI 只列了「按 owner 枚举」的子集；整集枚举（ERC721Enumerable）还缺
// totalSupply / tokenByIndex 两个只读方法（链上已实测存在，见 smoke-jns-domains.mjs
// Phase 1/2）。不改共享的 jns.ts，在本文件内扩展（参考仓库 ABI 同一格式）。
const jnsDomainsABI = [
  ...jnsABI,
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "tokenByIndex",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function",
  },
] as const

// 与 utils/jns-holdings.ts 相同的调用类型标注方式（viem multicall 混合函数名联合）
type JnsViewCall = {
  address: `0x${string}`
  abi: typeof jnsDomainsABI
  functionName: 'tokenByIndex' | '_allTokensName' | 'ownerOf' | '_bound'
  args: readonly unknown[]
}

export function useJnsDomains() {
  const totalSupply = ref(0)
  const domains = ref<JnsDomainEntry[]>([])
  /** 已覆盖的全局索引数（游标，与 domains.length 可能因个别读取失败而不同） */
  const loadedCount = ref(0)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  /** 读取失败的子调用计数（tokenByIndex / 名称 / 所有者 / 绑定），用于 UI 可见提示 */
  const failedCount = ref(0)

  const hasMore = computed(() => loadedCount.value < totalSupply.value)
  const boundCount = computed(() => domains.value.filter((d) => d.isBound).length)
  const ownerCount = computed(
    () => new Set(domains.value.map((d) => d.owner.toLowerCase())).size,
  )

  // 并发守卫：刷新/翻页交错时丢弃过期请求的写入（同 useJNSVote 的 seq 模式）
  let seq = 0
  // 组件卸载取消：onScopeDispose 置位后不再写状态、不再继续打 RPC（loadAll 循环体短路）
  let disposed = false
  onScopeDispose(() => { disposed = true })

  // 分块 multicall：单请求子调用数封顶，避免请求体过大被 RPC 网关拒绝
  async function multicallChunked(calls: JnsViewCall[]): Promise<{ ok: boolean; value: unknown }[]> {
    const out: { ok: boolean; value: unknown }[] = []
    for (let i = 0; i < calls.length; i += MULTICALL_CHUNK) {
      const chunk = calls.slice(i, i + MULTICALL_CHUNK)
      const res = await publicClient.multicall({ contracts: chunk, allowFailure: true })
      for (const r of res) {
        out.push({ ok: r.status === 'success', value: r.status === 'success' ? r.result : null })
      }
    }
    return out
  }

  // 枚举全局索引区间 [start..end]（降序 = 新 → 旧）。
  // 返回本批条目 + 失败计数；失败绝不静默吞掉：tokenByIndex/名称/所有者失败计入 failed，
  // _bound 失败标记 boundUnknown（而非伪造为「未绑定」）。
  async function fetchRange(start: number, end: number): Promise<{ entries: JnsDomainEntry[]; failed: number }> {
    const idxCalls: JnsViewCall[] = []
    for (let i = end; i >= start; i--) {
      idxCalls.push({ address: JNS_ADDRESS, abi: jnsDomainsABI, functionName: 'tokenByIndex', args: [BigInt(i)] })
    }
    const idxRes = await multicallChunked(idxCalls)
    let failed = 0
    const tokenIds = idxRes.map((r) => {
      if (r.ok && typeof r.value === 'bigint') return Number(r.value)
      failed++
      return -1
    })

    // 每个有效 tokenId 读三连：名称 / 所有者 / 绑定地址
    const detailCalls: JnsViewCall[] = []
    for (const tid of tokenIds) {
      if (tid < 0) continue
      detailCalls.push({ address: JNS_ADDRESS, abi: jnsDomainsABI, functionName: '_allTokensName', args: [BigInt(tid)] })
      detailCalls.push({ address: JNS_ADDRESS, abi: jnsDomainsABI, functionName: 'ownerOf', args: [BigInt(tid)] })
      detailCalls.push({ address: JNS_ADDRESS, abi: jnsDomainsABI, functionName: '_bound', args: [BigInt(tid)] })
    }
    const detailRes = await multicallChunked(detailCalls)

    const entries: JnsDomainEntry[] = []
    let j = 0
    for (const tid of tokenIds) {
      if (tid < 0) continue
      // 先落局部常量再判型：TS 对可变下标的元素访问不做窄化
      const nameRaw = detailRes[j]
      const ownerRaw = detailRes[j + 1]
      const boundRaw = detailRes[j + 2]
      j += 3

      const name = nameRaw?.ok && typeof nameRaw.value === 'string' ? nameRaw.value : ''
      const owner = ownerRaw?.ok && typeof ownerRaw.value === 'string' ? ownerRaw.value : ''

      // 名称/所有者读取失败：无法展示该条，计入 failed 并跳过
      if (!name || !owner) {
        if (name === '') failed++
        if (owner === '') failed++
        continue
      }

      // _bound 读取失败 ≠ 未绑定：显式标记 boundUnknown，绝不用零地址掩盖失败
      const bound = boundRaw?.ok && typeof boundRaw.value === 'string' ? boundRaw.value : null
      let boundAddress = ZERO_ADDRESS
      let isBound = false
      let boundUnknown = false
      if (bound !== null) {
        boundAddress = bound
        isBound = bound !== ZERO_ADDRESS
      } else {
        boundUnknown = true
        failed++
      }

      entries.push({ tokenId: tid, name, owner, boundAddress, isBound, boundUnknown })
    }
    return { entries, failed }
  }

  async function fetchTotalSupply(): Promise<number> {
    const raw = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsDomainsABI,
      functionName: 'totalSupply',
    })
    return Number(raw)
  }

  // 首屏（兼作刷新/重试）：重置后加载最新一页
  async function loadFirstPage() {
    const mySeq = ++seq
    isLoading.value = true
    loadError.value = null
    domains.value = []
    loadedCount.value = 0
    failedCount.value = 0
    try {
      totalSupply.value = await fetchTotalSupply()
      if (mySeq !== seq || disposed) return
      if (totalSupply.value <= 0) return
      const end = totalSupply.value - 1
      const start = Math.max(0, end - JNS_DOMAINS_PAGE_SIZE + 1)
      const { entries, failed } = await fetchRange(start, end)
      if (mySeq !== seq || disposed) return
      domains.value = entries
      loadedCount.value = end - start + 1
      failedCount.value = failed
    } catch (e) {
      if (mySeq !== seq || disposed) return
      loadError.value = safeErrorMessage(e)
    } finally {
      if (mySeq === seq && !disposed) isLoading.value = false
    }
  }

  // 加载更旧的一批（count 可选，默认一页）
  async function loadMore(count = JNS_DOMAINS_PAGE_SIZE) {
    if (isLoading.value || disposed) return
    if (totalSupply.value > 0 && !hasMore.value) return
    const mySeq = ++seq
    isLoading.value = true
    loadError.value = null
    try {
      if (totalSupply.value <= 0) {
        totalSupply.value = await fetchTotalSupply()
        if (mySeq !== seq || disposed) return
      }
      if (loadedCount.value >= totalSupply.value) return
      const end = totalSupply.value - 1 - loadedCount.value
      const start = Math.max(0, end - count + 1)
      const { entries, failed } = await fetchRange(start, end)
      if (mySeq !== seq || disposed) return
      domains.value = [...domains.value, ...entries]
      loadedCount.value += end - start + 1
      failedCount.value += failed
    } catch (e) {
      if (mySeq !== seq || disposed) return
      loadError.value = safeErrorMessage(e)
    } finally {
      if (mySeq === seq && !disposed) isLoading.value = false
    }
  }

  // 加载全部剩余：按 MULTICALL_CHUNK 分段，逐段追加（进度可见，不一次性打满）
  async function loadAll() {
    if (isLoading.value || disposed) return
    const mySeq = ++seq
    isLoading.value = true
    loadError.value = null
    try {
      if (totalSupply.value <= 0) {
        totalSupply.value = await fetchTotalSupply()
        if (mySeq !== seq || disposed) return
      }
      while (loadedCount.value < totalSupply.value) {
        if (mySeq !== seq || disposed) return
        const end = totalSupply.value - 1 - loadedCount.value
        const start = Math.max(0, end - MULTICALL_CHUNK + 1)
        const { entries, failed } = await fetchRange(start, end)
        if (mySeq !== seq || disposed) return
        domains.value = [...domains.value, ...entries]
        loadedCount.value += end - start + 1
        failedCount.value += failed
      }
    } catch (e) {
      if (mySeq !== seq || disposed) return
      loadError.value = safeErrorMessage(e)
    } finally {
      if (mySeq === seq && !disposed) isLoading.value = false
    }
  }

  return {
    totalSupply,
    domains,
    loadedCount,
    failedCount,
    isLoading,
    loadError,
    hasMore,
    boundCount,
    ownerCount,
    loadFirstPage,
    loadMore,
    loadAll,
  }
}
