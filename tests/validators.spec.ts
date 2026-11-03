import { describe, expect, it, vi } from 'vitest'
import { checkpointNumber, createCheckpointLoader, parseCheckpointSigners } from '../src/utils/clique-signers'
import type { Hex } from 'viem'
import fixture from './fixtures/clique-checkpoint-8550000.json'

function extra(count: number): Hex {
  return `0x${'00'.repeat(32)}${Array.from({ length: count }, (_, i) => (i + 1).toString(16).padStart(40, '0')).join('')}${'00'.repeat(65)}`
}
function client() {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(8_579_029n),
    getBlock: vi.fn().mockResolvedValue({ number: 8_550_000n, hash: `0x${'ab'.repeat(32)}`, extraData: extra(16) }),
  }
}
describe('Clique 检查点解析', () => {
  it('真链检查点留档解析与现场地址清单一致', () => {
    expect(parseCheckpointSigners(fixture.extraData).map(a => a.toLowerCase())).toEqual(fixture.addresses)
  })
  it.each([1, 2, 16, 17])('支持 %i 个签名人，不固定为16', count => {
    const addresses = parseCheckpointSigners(extra(count))
    expect(addresses).toHaveLength(count)
    expect(addresses[0]).toBe('0x0000000000000000000000000000000000000001')
  })
  it.each(['', '0x', '0xgg', '0x123', '0x00', extra(0), `0x${'00'.repeat(118)}`])('拒绝异常长度/字节串 %s', value => {
    expect(() => parseCheckpointSigners(value)).toThrow()
  })
  it('拒绝零地址和重复地址', () => {
    expect(() => parseCheckpointSigners(`0x${'00'.repeat(117)}`)).toThrow()
    const address = '01'.repeat(20)
    expect(() => parseCheckpointSigners(`0x${'00'.repeat(32)}${address}${address}${'00'.repeat(65)}`)).toThrow()
  })
  it.each([[0n, 0n], [29999n, 0n], [30000n, 30000n], [30001n, 30000n], [8579029n, 8550000n]])('高度 %s 的检查点为 %s', (head, expected) => {
    expect(checkpointNumber(head)).toBe(expected)
  })
  it('拒绝负数高度', () => expect(() => checkpointNumber(-1n)).toThrow())
})
describe('有界读取和缓存', () => {
  it('合并并发请求，60秒内命中缓存，过期才重读', async () => {
    const rpc = client()
    let time = 1000
    const load = createCheckpointLoader(rpc, () => time)
    const [a, b] = await Promise.all([load(), load()])
    expect(a).toBe(b)
    expect(a.signers).toHaveLength(16)
    expect(rpc.getBlockNumber).toHaveBeenCalledExactlyOnceWith({ cacheTime: 0 })
    expect(rpc.getBlock).toHaveBeenCalledExactlyOnceWith({ blockNumber: 8550000n, includeTransactions: false })
    expect(await load()).toBe(a)
    time += 60_000
    await load()
    expect(rpc.getBlock).toHaveBeenCalledTimes(2)
  })
  it('节点失败后允许重试，不缓存失败', async () => {
    const rpc = client()
    rpc.getBlock.mockRejectedValueOnce(new Error('offline'))
    const load = createCheckpointLoader(rpc)
    await expect(load()).rejects.toThrow('offline')
    await expect(load()).resolves.toHaveProperty('epochBlock', 8550000n)
    expect(rpc.getBlock).toHaveBeenCalledTimes(2)
  })
  it.each([{ number: 1n }, { hash: null }, { hash: '0x12' }, { extraData: extra(0) }])('拒绝不匹配或损坏的检查点 %s', async override => {
    const rpc = client()
    rpc.getBlock.mockResolvedValue({ number: 8550000n, hash: `0x${'ab'.repeat(32)}`, extraData: extra(16), ...override })
    await expect(createCheckpointLoader(rpc)()).rejects.toThrow()
  })
})
