// JNS 域名持有列表批量读取工具（multicall3 聚合，2026-08-11）
// 背景: 原逻辑 balanceOf(1) + tokenOfOwnerByIndex(N) + _allTokensName(N) = 1+2N 次 RPC
// 优化: 步骤A(含 balanceOf) + 步骤B 各 1 次 multicall = 2 次 RPC
// 注意: _allTokensName 依赖 tokenOfOwnerByIndex 的 tokenId 结果，故必须分两步

import { publicClient } from '../config/client'
import { JNS_ADDRESS, jnsABI } from '../contracts/jns'

export interface JnsHoldingBatch {
  /** 持有总数（withBalance=true 时返回） */
  balance?: bigint
  /** 本批 tokenId（越界/失败的已过滤） */
  tokenIds: bigint[]
  /** 本批域名名字（与 tokenIds 一一对应） */
  names: string[]
}

/**
 * 批量读取某地址的 JNS 域名持有
 * @param owner 持有者地址
 * @param start 起始 index（tokenOfOwnerByIndex）
 * @param count 本批数量
 * @param withBalance 是否同时读取 balanceOf（首次加载用）
 */
export async function fetchJnsHoldingBatch(
  owner: string,
  start: number,
  count: number,
  withBalance = false
): Promise<JnsHoldingBatch> {
  // ── 步骤 A：balanceOf(可选) + tokenOfOwnerByIndex × count ──
  const aCalls: { address: `0x${string}`; abi: typeof jnsABI; functionName: 'balanceOf' | 'tokenOfOwnerByIndex'; args: readonly unknown[] }[] = []
  if (withBalance) {
    aCalls.push({ address: JNS_ADDRESS, abi: jnsABI, functionName: 'balanceOf', args: [owner as `0x${string}`] })
  }
  for (let i = 0; i < count; i++) {
    aCalls.push({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [owner as `0x${string}`, BigInt(start + i)] as const,
    })
  }

  // allowFailure: true —— 持有数少于 count 时，越界 index 会 revert，过滤掉即可
  const aResults = await publicClient.multicall({ contracts: aCalls, allowFailure: true })

  const balance = withBalance ? (aResults[0].result as bigint | undefined) : undefined
  const tokenIds = (withBalance ? aResults.slice(1) : aResults)
    .filter((r) => r.status === 'success')
    .map((r) => r.result as bigint)

  // ── 步骤 B：_allTokensName × tokenIds（依赖 A 的结果）──
  if (tokenIds.length === 0) {
    return { balance, tokenIds: [], names: [] }
  }
  const bCalls = tokenIds.map((id) => ({
    address: JNS_ADDRESS,
    abi: jnsABI,
    functionName: '_allTokensName' as const,
    args: [id] as const,
  }))
  const bResults = await publicClient.multicall({ contracts: bCalls, allowFailure: true })

  const names = bResults
    .filter((r) => r.status === 'success')
    .map((r) => r.result as string)

  return { balance, tokenIds, names }
}
