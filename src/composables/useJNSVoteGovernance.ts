// JNSVote 治理端数据层：创建提案（多签流程）+ 待确认交易管理
// 权限模型：createProposal 是 onlyOwner，owner = 2/3 多签（Koant/剪云为裳/明海云）。
//   前端仅对「签名人」展示治理入口；创建提案 = submitTransaction（提交者自动成为首确认人），
//   其余签名人 confirm，确认数达标后任一签名人 execute。
// 依赖：wagmi writeContract（签名）/ publicClient readContract（只读）。

import { ref, computed } from 'vue'
import { writeContract, waitForTransactionReceipt, switchChain } from 'wagmi/actions'
import { encodeFunctionData, decodeFunctionData } from 'viem'
import { publicClient } from '../config/client'
import { jouleverseChain } from '../config/chain'
import { config as wagmiConfig } from '../stores/wallet'
import { JNSVOTE_ADDRESS } from '../contracts/jnsvote'
import {
  JNSVOTE_MULTISIG_ADDRESS,
  multisigABI,
  createProposalABI,
} from '../contracts/jnsvoteGovernance'
import { safeErrorMessage } from '../utils/error'

export interface PendingProposalTx {
  txId: number
  destination: string
  executed: boolean
  confirmed: boolean // isConfirmed = 确认数 >= required
  confirmationCount: number
  required: number
  confirmations: string[] // 已确认的签名人地址（小写）
  // 解码后的 createProposal 参数（destination 为 JNSVote 时才有意义）
  title: string
  link: string
  timeBegin: bigint
  timeEnd: bigint
}

export function useJNSVoteGovernance() {
  const isSigner = ref(false)
  const signers = ref<string[]>([])
  const required = ref(0n)
  const pendingTxs = ref<PendingProposalTx[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  // 是否有待执行的多签交易
  const hasPending = computed(() => pendingTxs.value.some((t) => !t.executed))

  // 读取治理状态：当前地址是否签名人 + 待执行交易列表
  async function loadGovernance(address: string) {
    isLoading.value = true
    loadError.value = null
    try {
      const [ownersRaw, requiredRaw] = await publicClient.multicall({
        contracts: [
          { address: JNSVOTE_MULTISIG_ADDRESS, abi: multisigABI, functionName: 'getOwners' },
          { address: JNSVOTE_MULTISIG_ADDRESS, abi: multisigABI, functionName: 'required' },
        ],
        allowFailure: false,
      })

      const owners = (ownersRaw as readonly string[]).map((a) => a.toLowerCase())
      signers.value = [...owners]
      required.value = BigInt(requiredRaw as bigint)
      isSigner.value = owners.includes(address.toLowerCase())

      // 读待执行交易 id 列表（pending=true, executed=false）
      const countRaw = await publicClient.readContract({
        address: JNSVOTE_MULTISIG_ADDRESS,
        abi: multisigABI,
        functionName: 'getTransactionCount',
        args: [true, false],
      })
      const count = Number(countRaw)
      const ids: number[] = []
      if (count > 0) {
        const idsRaw = await publicClient.readContract({
          address: JNSVOTE_MULTISIG_ADDRESS,
          abi: multisigABI,
          functionName: 'getTransactionIds',
          args: [0n, BigInt(count), true, false],
        })
        ids.push(...(idsRaw as readonly bigint[]).map((n) => Number(n)))
      }

      // 逐笔读详情 + 确认状态（multicall 聚合）
      const txCalls = ids.flatMap((id) => [
        { address: JNSVOTE_MULTISIG_ADDRESS, abi: multisigABI, functionName: 'transactions' as const, args: [BigInt(id)] as const },
        { address: JNSVOTE_MULTISIG_ADDRESS, abi: multisigABI, functionName: 'isConfirmed' as const, args: [BigInt(id)] as const },
        { address: JNSVOTE_MULTISIG_ADDRESS, abi: multisigABI, functionName: 'getConfirmations' as const, args: [BigInt(id)] as const },
      ])
      const txResults = await publicClient.multicall({ contracts: txCalls, allowFailure: true })

      const list: PendingProposalTx[] = []
      ids.forEach((id, i) => {
        const base = i * 3
        const txRes = txResults[base]
        if (!txRes.result) return // 单笔读取失败则跳过，不阻塞整体

        const confRes = txResults[base + 1]
        const confsRes = txResults[base + 2]

        const [destination, , data, executed] = txRes.result as readonly [string, bigint, string, boolean]
        const confirmed = confRes.result != null ? Boolean(confRes.result as boolean) : false
        const confirmations = confsRes.result != null
          ? (confsRes.result as readonly string[]).map((a) => a.toLowerCase())
          : []

        // 解码 createProposal 参数（仅当 destination 为 JNSVote 时才有意义）
        let title = ''
        let link = ''
        let timeBegin = 0n
        let timeEnd = 0n
        if (destination.toLowerCase() === JNSVOTE_ADDRESS.toLowerCase() && data && data !== '0x') {
          try {
            const decoded = decodeProposalData(data)
            title = decoded.title
            link = decoded.link
            timeBegin = decoded.timeBegin
            timeEnd = decoded.timeEnd
          } catch {
            // 非 createProposal 交易：保留空字段，仍展示 txId/确认状态
          }
        }

        list.push({
          txId: id,
          destination,
          executed: Boolean(executed),
          confirmed,
          confirmationCount: confirmations.length,
          required: Number(requiredRaw),
          confirmations,
          title,
          link,
          timeBegin,
          timeEnd,
        })
      })

      pendingTxs.value = list
    } catch (e) {
      loadError.value = safeErrorMessage(e)
    } finally {
      isLoading.value = false
    }
  }

  // 解码 createProposal 的 calldata
  function decodeProposalData(data: string): { title: string; link: string; timeBegin: bigint; timeEnd: bigint } {
    const result = decodeFunctionData({
      abi: createProposalABI,
      data: data as `0x${string}`,
    })
    const args = result.args as readonly [string, string, bigint, bigint]
    return { title: args[0], link: args[1], timeBegin: args[2], timeEnd: args[3] }
  }

  // 创建提案：提交多签交易（提交者自动成为首确认人），返回 transactionId
  async function submitProposal(input: {
    title: string
    link: string
    timeBegin: bigint
    timeEnd: bigint
  }): Promise<number> {
    const data = encodeFunctionData({
      abi: createProposalABI,
      functionName: 'createProposal',
      args: [input.title, input.link, input.timeBegin, input.timeEnd],
    })

    await ensureChain()

    const hash = await writeContract(wagmiConfig, {
      address: JNSVOTE_MULTISIG_ADDRESS,
      abi: multisigABI,
      functionName: 'submitTransaction',
      args: [JNSVOTE_ADDRESS, 0n, data],
    })

    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
    if (receipt.status === 'reverted') {
      throw new Error('提交多签交易已回滚')
    }

    return parseSubmissionTxId(receipt)
  }

  // 确保钱包在 Jouleverse 链上（与 useJNSVote.vote 一致；已在目标链时 switchChain 直接成功）
  async function ensureChain(): Promise<void> {
    await switchChain(wagmiConfig, { chainId: jouleverseChain.id })
  }

  // 从 receipt 解析 Submission 事件拿 transactionId
  // Gnosis MultiSigWallet 事件：event Submission(uint indexed transactionId)
  // topic0 = keccak256('Submission(uint256)')，topic[1] = indexed transactionId
  function parseSubmissionTxId(receipt: { logs: readonly { topics: readonly string[] }[] }): number {
    const SUBMISSION_TOPIC = '0xc0ba8fe4b176c1714197d43b9cc6bcf797a4a7461c5fe8d0ef6e184ae7601e51'
    for (const log of receipt.logs) {
      if (log.topics.length >= 2 && log.topics[0].toLowerCase() === SUBMISSION_TOPIC) {
        return parseInt(log.topics[1], 16)
      }
    }
    // 兜底：无法解析时返回 -1（提交成功但 id 未知，界面提示刷新查看）
    return -1
  }

  // 确认交易（其余签名人）
  async function confirmTx(txId: number): Promise<void> {
    await ensureChain()
    const hash = await writeContract(wagmiConfig, {
      address: JNSVOTE_MULTISIG_ADDRESS,
      abi: multisigABI,
      functionName: 'confirmTransaction',
      args: [BigInt(txId)],
    })
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
    if (receipt.status === 'reverted') {
      throw new Error('确认多签交易已回滚')
    }
  }

  // 执行交易（确认数达标后任一签名人）
  async function executeTx(txId: number): Promise<void> {
    await ensureChain()
    const hash = await writeContract(wagmiConfig, {
      address: JNSVOTE_MULTISIG_ADDRESS,
      abi: multisigABI,
      functionName: 'executeTransaction',
      args: [BigInt(txId)],
    })
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
    if (receipt.status === 'reverted') {
      throw new Error('执行多签交易已回滚')
    }
  }

  return {
    isSigner,
    signers,
    required,
    pendingTxs,
    hasPending,
    isLoading,
    loadError,
    loadGovernance,
    submitProposal,
    confirmTx,
    executeTx,
  }
}
