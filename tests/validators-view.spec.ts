import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
const mocks = vi.hoisted(() => ({ getBlockNumber: vi.fn(), getBlock: vi.fn() }))
vi.mock('../src/config/client', () => ({ publicClient: mocks }))
import Validators from '../src/views/Validators.vue'
import { JvActionButton } from '../src/design-system'

afterEach(() => vi.restoreAllMocks())
it('失败有明确错误，可重试；显示检查点与限制，刷新使用缓存', async () => {
  mocks.getBlockNumber.mockRejectedValueOnce(new Error('测试节点离线')).mockResolvedValue(30001n)
  mocks.getBlock.mockResolvedValue({ number: 30000n, hash: `0x${'ab'.repeat(32)}`,
    extraData: `0x${'00'.repeat(32)}${'01'.repeat(20)}${'00'.repeat(65)}` })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/validators')
  const w = mount(Validators, { global: { plugins: [router] } })
  await flushPromises()
  expect(w.text()).toContain('测试节点离线')
  expect(w.find('[data-testid="signer-count"]').exists()).toBe(false)
  await w.getComponent(JvActionButton).trigger('click')
  await flushPromises()
  expect(w.get('[data-testid="signer-count"]').text()).toBe('1')
  expect(w.findAll('.signers li')).toHaveLength(1)
  expect(w.text()).toContain('Miner 字段不承载出块者')
  expect(w.text()).toContain('不重放投票')
  expect(w.text()).toContain('未做')
  expect(w.get('.signers a').attributes('href')).toBe(`/address/0x${'01'.repeat(20)}`)
  await w.getComponent(JvActionButton).trigger('click')
  await flushPromises()
  expect(mocks.getBlock).toHaveBeenCalledTimes(1)
  w.unmount()
})
