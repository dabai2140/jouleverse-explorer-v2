// JNSVote 数据层：提案列表 / 资格检查 / 徽章
// v1 参考: docs/reference/jnsvote/jnsVoteInfoController.js

import { ref } from 'vue'
import { publicClient } from '../config/client'
import { JNSVOTE_ADDRESS, JTI_ADDRESS, jnsVoteABI, jtiABI } from '../contracts/jnsvote'
import { JNS_ADDRESS, jnsABI } from '../contracts/jns'
import { jnsvoteDecision, approvalRate, representativeRate } from '../utils/jnsvote-decision'

const BLOCK_TIME_SEC = 15 // Jouleverse 平均出块时间（v1 用 15s 估算倒计时）

export type ProposalStatus = 'pending' | 'active' | 'ended'

export interface JNSVoteProposal {
  id: number
  title: string
  link: string
  timeBegin: bigint // 区块高度
  timeEnd: bigint
  countVotesFor: bigint
  countVotesAgainst: bigint
  countJNSvoted: bigint
  countJNSvotedFor: bigint
  totalJNS: bigint
  disabled: boolean
  // 派生状态
  status: ProposalStatus
  decision: 1 | -1 | 0
  ar: number | null // 支持率 %
  rr: number | null // 代表率 %
}

export interface VoteEligibility {
  hasJTI: boolean
  hasJNS: boolean
  jtiCount: bigint
  jnsCount: bigint
}

export function useJNSVote() {
  const proposals = ref<JNSVoteProposal[]>([])
  const totalProposals = ref(0)
  const currentBlock = ref(0n)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  // 资格检查结果（当前连接地址）
  const eligibility = ref<VoteEligibility | null>(null)
  // 已投票的提案 id 集合（基于 _jti_voted 查询）
  const votedProposals = ref<Set<number>>(new Set())

  // 读取当前区块高度
  async function fetchCurrentBlock() {
    currentBlock.value = await publicClient.getBlockNumber()
    return currentBlock.value
  }

  // 加载全部提案（并行读取，含状态派生）
  // 注：不用 multicall——Jouleverse chain 未配置 multicall3，改用 Promise.all + readContract 并行读
  async function loadProposals() {
    isLoading.value = true
    loadError.value = null
    try {
      const block = await fetchCurrentBlock()

      const totalRaw = await publicClient.readContract({
        address: JNSVOTE_ADDRESS,
        abi: jnsVoteABI,
        functionName: '_totalProposals',
      })

      const total = Number(totalRaw)
      totalProposals.value = total

      if (total === 0) {
        proposals.value = []
        return
      }

      // 并行读取所有提案（v1 逐个串行，这里 Promise.all 一次并发）
      const calls = Array.from({ length: total }, (_, i) => ({
        address: JNSVOTE_ADDRESS as `0x${string}`,
        abi: jnsVoteABI,
        functionName: '_proposals' as const,
        args: [BigInt(i + 1)] as const,
      }))

      const settled = await Promise.allSettled(calls.map((c) => publicClient.readContract(c)))

      const list: JNSVoteProposal[] = []
      settled.forEach((res, idx) => {
        const id = idx + 1
        if (res.status === 'rejected') {
          // 单条失败：仍占位，标记为异常（不阻塞整体）
          list.push({
            id,
            title: '(读取失败)',
            link: '',
            timeBegin: 0n,
            timeEnd: 0n,
            countVotesFor: 0n,
            countVotesAgainst: 0n,
            countJNSvoted: 0n,
            countJNSvotedFor: 0n,
            totalJNS: 0n,
            disabled: true,
            status: 'ended',
            decision: 0,
            ar: null,
            rr: null,
          })
          return
        }
        const p = res.value
        const timeBegin = p[2]
        const timeEnd = p[3]
        const countVotesFor = p[4]
        const countVotesAgainst = p[5]
        const countJNSvoted = p[6]
        const countJNSvotedFor = p[7]
        const totalJNS = p[8]
        const disabled = p[9]

        let status: ProposalStatus
        if (disabled) status = 'ended'
        else if (block < timeBegin) status = 'pending'
        else if (block < timeEnd) status = 'active'
        else status = 'ended'

        const decision = status === 'ended' && !disabled
          ? jnsvoteDecision(id, countVotesFor, countVotesAgainst, countJNSvotedFor, totalJNS)
          : 0

        list.push({
          id,
          title: p[0],
          link: p[1],
          timeBegin,
          timeEnd,
          countVotesFor,
          countVotesAgainst,
          countJNSvoted,
          countJNSvotedFor,
          totalJNS,
          disabled,
          status,
          decision,
          ar: approvalRate(countVotesFor, countVotesAgainst),
          rr: representativeRate(countJNSvotedFor, totalJNS),
        })
      })

      proposals.value = list
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  // 资格检查：JTI 余额 > 0 且 JNS 余额 > 0
  async function checkEligibility(address: string) {
    try {
      const [jtiCount, jnsCount] = await Promise.all([
        publicClient.readContract({
          address: JTI_ADDRESS,
          abi: jtiABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: JNS_ADDRESS,
          abi: jnsABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
      ])
      eligibility.value = {
        hasJTI: jtiCount > 0n,
        hasJNS: jnsCount > 0n,
        jtiCount,
        jnsCount,
      }
      return eligibility.value
    } catch {
      eligibility.value = null
      return null
    }
  }

  // 检查某地址在哪些提案已投票（并行查 _jti_voted）
  async function checkVoted(address: string, proposalIds: number[]) {
    const calls = proposalIds.map((id) => ({
      address: JNSVOTE_ADDRESS as `0x${string}`,
      abi: jnsVoteABI,
      functionName: '_jti_voted' as const,
      args: [BigInt(id), address as `0x${string}`] as const,
    }))
    const settled = await Promise.allSettled(calls.map((c) => publicClient.readContract(c)))
    const voted = new Set<number>()
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled' && (res.value as readonly unknown[])[0] !== 0n) {
        voted.add(proposalIds[idx])
      }
    })
    votedProposals.value = voted
    return voted
  }

  // 区块差 → 人类可读倒计时（v1 formatTime：天/小时/分钟）
  function formatCountdown(blockDiff: bigint): string {
    const seconds = Number(blockDiff) * BLOCK_TIME_SEC
    if (seconds <= 0) return ''
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    let result = ''
    if (days > 0) result += `${days}天`
    if (hours > 0) result += `${hours}小时`
    if (minutes > 0) result += `${minutes}分钟`
    return result || '即将'
  }

  // 初始化：加载提案 + （可选）资格/已投检查
  async function init(address?: string | null) {
    await loadProposals()
    if (address) {
      await checkEligibility(address)
      await checkVoted(address, proposals.value.map((p) => p.id))
    }
  }

  return {
    proposals,
    totalProposals,
    currentBlock,
    isLoading,
    loadError,
    eligibility,
    votedProposals,
    loadProposals,
    checkEligibility,
    checkVoted,
    formatCountdown,
    init,
  }
}
