import { ref } from 'vue'
import { createPublicClient, http } from 'viem'
import { jouleverseChain } from '../config/chain'
import { JVCORE_ADDRESS, jvcoreABI } from '../contracts/jvcore'
import { POPBADGE_ADDRESS, popbadgeABI } from '../contracts/popbadge'
import { parseTokenURI } from '../utils/nftMetadata'
import type { CoreIdInfo, PopHistoryEntry } from '../types/coreid'

const client = createPublicClient({ chain: jouleverseChain, transport: http() })

export function useCoreId(address: string) {
  const coreIds = ref<CoreIdInfo[]>([])
  const popHistory = ref<PopHistoryEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 我的Core ID：port自 v1 getAllJVCore（addressInfoController.js 第808-843行）
  const loadMyCoreIds = async () => {
    const result: CoreIdInfo[] = []

    const balance = await client.readContract({
      address: JVCORE_ADDRESS,
      abi: jvcoreABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })

    for (let i = 0n; i < balance; i++) {
      const tokenId = await client.readContract({
        address: JVCORE_ADDRESS,
        abi: jvcoreABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address as `0x${string}`, i],
      })

      const tokenURI = await client.readContract({
        address: JVCORE_ADDRESS,
        abi: jvcoreABI,
        functionName: 'tokenURI',
        args: [tokenId],
      })

      result.push({ tokenId, metadata: parseTokenURI(tokenURI) })
    }

    coreIds.value = result
  }

  // 我的POP签到历史：port自 v1 getAllPOP（addressInfoController.js 第845-891行）
  const loadMyPopHistory = async () => {
    const result: PopHistoryEntry[] = []

    // 当前地址自己的Core ID，用于"代打卡"判断；地址本身没有Core ID则全部置灰
    const coreId = coreIds.value.length > 0 ? coreIds.value[0].tokenId : null

    const balance = await client.readContract({
      address: POPBADGE_ADDRESS,
      abi: popbadgeABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })

    for (let i = 0n; i < balance; i++) {
      const tokenId = await client.readContract({
        address: POPBADGE_ADDRESS,
        abi: popbadgeABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address as `0x${string}`, i],
      })

      const tokenURI = await client.readContract({
        address: POPBADGE_ADDRESS,
        abi: popbadgeABI,
        functionName: 'tokenURI',
        args: [tokenId],
      })

      const metadata = parseTokenURI(tokenURI)
      // v1: var is_valid = tokenInfo.coreId == core_id (松类型比较)；这里桥接number/bigint
      const isValid = coreId !== null && metadata !== null && BigInt(metadata.coreId ?? -1) === coreId

      const date = new Date((metadata?.checkInTimestamp ?? 0) * 1000)
      const monthLabel = `${date.getFullYear().toString().slice(-2)}.${date.getMonth() + 1}`

      result.push({ tokenId, metadata, monthLabel, isValid })
    }

    // 按tokenId升序排序，与v1一致
    result.sort((a, b) => (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0))

    popHistory.value = result
  }

  const load = async () => {
    isLoading.value = true
    error.value = null
    try {
      await loadMyCoreIds()
      await loadMyPopHistory()
    } catch (err) {
      console.error('[useCoreId] 加载失败:', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    coreIds,
    popHistory,
    isLoading,
    error,
    load,
  }
}
