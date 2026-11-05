import { getAddress, type Address, type Hex } from 'viem'

export const CLIQUE_EPOCH = 30_000n

export function checkpointNumber(head: bigint): bigint {
  if (head < 0n) throw new Error('区块高度不能为负数')
  return head / CLIQUE_EPOCH * CLIQUE_EPOCH
}

/** 只解析检查点地址列表，不验证 seal，也不恢复后续投票。 */
export function parseCheckpointSigners(extraData: string): Address[] {
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(extraData)) throw new Error('extraData 不是有效十六进制字节串')
  const body = extraData.slice(2)
  const payloadLength = body.length - (32 + 65) * 2
  if (payloadLength <= 0 || payloadLength % 40 !== 0) throw new Error('检查点签名人列表长度无效')
  const addresses: Address[] = []
  const seen = new Set<string>()
  for (let i = 64; i < body.length - 130; i += 40) {
    const raw = `0x${body.slice(i, i + 40)}`.toLowerCase()
    if (/^0x0{40}$/.test(raw) || seen.has(raw)) throw new Error('签名人列表包含零地址或重复地址')
    seen.add(raw)
    addresses.push(getAddress(raw))
  }
  return addresses
}

export interface CheckpointClient {
  getBlockNumber: (args: { cacheTime: number }) => Promise<bigint>
  getBlock: (args: { blockNumber: bigint; includeTransactions: false }) => Promise<{
    number: bigint | null; hash: Hex | null; extraData: Hex
  }>
}

export interface SignerSnapshot {
  observedHead: bigint
  epochBlock: bigint
  hash: Hex
  signers: Address[]
  fetchedAt: number
}

/** 每次未命中缓存：一次高度查询 + 仅一个检查点区块查询。 */
export function createCheckpointLoader(client: CheckpointClient, now = Date.now) {
  let cached: SignerSnapshot | undefined
  let inFlight: Promise<SignerSnapshot> | undefined
  return function load(): Promise<SignerSnapshot> {
    if (cached && now() - cached.fetchedAt < 60_000) return Promise.resolve(cached)
    if (inFlight) return inFlight
    inFlight = (async () => {
      const observedHead = await client.getBlockNumber({ cacheTime: 0 })
      const epochBlock = checkpointNumber(observedHead)
      const block = await client.getBlock({ blockNumber: epochBlock, includeTransactions: false })
      if (block.number !== epochBlock || !block.hash || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) {
        throw new Error('节点返回的检查点高度或区块哈希无效')
      }
      const signers = parseCheckpointSigners(block.extraData)
      cached = { observedHead, epochBlock, hash: block.hash, signers, fetchedAt: now() }
      return cached
    })().finally(() => { inFlight = undefined })
    return inFlight
  }
}
