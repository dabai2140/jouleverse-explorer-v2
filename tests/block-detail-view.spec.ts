import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const mocks = vi.hoisted(() => ({ getBlockNumber: vi.fn(), getBlock: vi.fn() }))
vi.mock('../src/config/client', () => ({ publicClient: mocks }))

import BlockDetail from '../src/views/BlockDetail.vue'

afterEach(() => vi.restoreAllMocks())

const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })

const mountAt = async (blockNumber: string) => {
  const r = router()
  await r.push(`/block/${blockNumber}`)
  return mount(BlockDetail, {
    props: { number: blockNumber },
    global: { plugins: [r] },
  })
}

const tx = (hash: string, input: string) => ({
  hash,
  from: `0x${'11'.repeat(20)}`,
  to: `0x${'22'.repeat(20)}`,
  value: 1000n,
  gas: 21000n,
  input,
})

it('显示确认数 = 最新高度 - 区块高度（v1 conf 口径）', async () => {
  mocks.getBlockNumber.mockResolvedValue(5000n)
  mocks.getBlock.mockResolvedValue({
    number: 4920n,
    hash: `0x${'aa'.repeat(32)}`,
    parentHash: `0x${'bb'.repeat(32)}`,
    timestamp: 1_700_000_000n,
    miner: `0x${'cc'.repeat(20)}`,
    gasLimit: 30_000_000n,
    gasUsed: 21_000n,
    difficulty: 1n,
    nonce: '0x0000000000000000',
    size: 512n,
    extraData: `0x${'00'.repeat(32)}${'01'.repeat(20)}${'00'.repeat(65)}`,
    transactions: [],
  })
  const w = await mountAt('4920')
  await flushPromises()
  expect(w.get('.conf-badge').text()).toBe('80 个区块')
})

it('extraData 含不可打印字节时只给原文，不吐乱码；同时给出字节数说明', async () => {
  mocks.getBlockNumber.mockResolvedValue(100n)
  mocks.getBlock.mockResolvedValue({
    number: 90n,
    hash: `0x${'aa'.repeat(32)}`,
    parentHash: `0x${'bb'.repeat(32)}`,
    timestamp: 1_700_000_000n,
    miner: `0x${'cc'.repeat(20)}`,
    gasLimit: 30_000_000n,
    gasUsed: 21_000n,
    difficulty: 1n,
    nonce: '0x0000000000000000',
    size: 512n,
    // 32 字节 vanity（全 0）+ 20 字节签名者 + 65 字节 seal
    extraData: `0x${'00'.repeat(32)}${'01'.repeat(20)}${'00'.repeat(65)}`,
    transactions: [],
  })
  const w = await mountAt('90')
  await flushPromises()
  expect(w.text()).toContain('附加数据')
  // raw hex 保留可核对
  expect(w.get('.hex-block').text()).toContain('0x0000000000000000')
  // 117 字节，全部不可读 → 不给「解读：」行
  expect(w.text()).toContain('117 字节二进制数据')
  expect(w.text()).not.toContain('解读：')
})

it('extraData 为可读 ASCII 时同时展示解读文本', async () => {
  mocks.getBlockNumber.mockResolvedValue(100n)
  mocks.getBlock.mockResolvedValue({
    number: 90n,
    hash: `0x${'aa'.repeat(32)}`,
    parentHash: `0x${'bb'.repeat(32)}`,
    timestamp: 1_700_000_000n,
    miner: `0x${'cc'.repeat(20)}`,
    gasLimit: 30_000_000n,
    gasUsed: 21_000n,
    difficulty: 1n,
    nonce: '0x0000000000000000',
    size: 512n,
    extraData: '0x68656c6c6f',
    transactions: [],
  })
  const w = await mountAt('90')
  await flushPromises()
  expect(w.text()).toContain('解读：hello')
})

it('纯转账不展示输入数据，带 calldata 的交易展示（对齐 v1 ng-if）', async () => {
  mocks.getBlockNumber.mockResolvedValue(100n)
  mocks.getBlock.mockResolvedValue({
    number: 90n,
    hash: `0x${'aa'.repeat(32)}`,
    parentHash: `0x${'bb'.repeat(32)}`,
    timestamp: 1_700_000_000n,
    miner: `0x${'cc'.repeat(20)}`,
    gasLimit: 30_000_000n,
    gasUsed: 21_000n,
    difficulty: 1n,
    nonce: '0x0000000000000000',
    size: 512n,
    extraData: '0x',
    transactions: [tx(`0x${'01'.repeat(32)}`, '0x'), tx(`0x${'02'.repeat(32)}`, '0xa9059cbb000000')],
  })
  const w = await mountAt('90')
  await flushPromises()
  // 2 笔交易但只有 1 处「输入数据」标签
  expect(w.findAll('.transaction-item')).toHaveLength(2)
  expect(w.findAll('.tx-input')).toHaveLength(1)
  expect(w.get('.tx-input').text()).toContain('0xa9059cbb000000')
})

it('最新高度取不到时确认数显示 0，且区块内容仍正常渲染（不整体失败）', async () => {
  mocks.getBlockNumber.mockRejectedValue(new Error('RPC 超时'))
  mocks.getBlock.mockResolvedValue({
    number: 90n,
    hash: `0x${'aa'.repeat(32)}`,
    parentHash: `0x${'bb'.repeat(32)}`,
    timestamp: 1_700_000_000n,
    miner: `0x${'cc'.repeat(20)}`,
    gasLimit: 30_000_000n,
    gasUsed: 21_000n,
    difficulty: 1n,
    nonce: '0x0000000000000000',
    size: 512n,
    extraData: '0x',
    transactions: [],
  })
  const w = await mountAt('90')
  await flushPromises()
  expect(w.get('.conf-badge').text()).toBe('0 个区块')
  expect(w.text()).toContain('区块 #90')
  expect(w.text()).toContain('Gas 限制')
})

it('区块不存在时给出未找到状态，不渲染确认数', async () => {
  mocks.getBlockNumber.mockResolvedValue(100n)
  mocks.getBlock.mockRejectedValue(new Error('not found'))
  const w = await mountAt('999999')
  await flushPromises()
  expect(w.text()).toContain('未找到区块')
  expect(w.find('.conf-badge').exists()).toBe(false)
})
