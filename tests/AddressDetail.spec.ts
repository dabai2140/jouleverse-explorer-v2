// AddressDetail.vue 组件测试：验证路由参数变化时 watch 重建地址数据
// 背景：同组件路由切换（地址页内点合约地址 / 区块页 miner / 交易页 from-to 跳转）时，
// props.address 变化但组件实例复用，setup 只跑一次 → 必须靠 watch 重建数据。
// 本测试断言 watch(() => props.address) 生效：改 props 后地址显示确实切换。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), currentRoute: { value: { params: {} } } }),
  useRoute: () => ({ params: {} }),
}))

// RPC 全部静默失败：组件内部 try/catch 兜底，不影响地址格式化断言
vi.mock('@/config/client', () => ({
  publicClient: {
    getBalance: vi.fn(() => Promise.reject(new Error('mock'))),
    getBlockNumber: vi.fn(() => Promise.reject(new Error('mock'))),
    getBlock: vi.fn(() => Promise.reject(new Error('mock'))),
    readContract: vi.fn(() => Promise.reject(new Error('mock'))),
    multicall: vi.fn(() => Promise.reject(new Error('mock'))),
    transport: { request: vi.fn(() => Promise.reject(new Error('mock'))) },
  },
}))

import AddressDetail from '@/views/AddressDetail.vue'

const ADDR_A = '0x7fba9BB966189Db8C4fE33B7bf67Bfa24203c6AD'
const ADDR_B = '0xf8AbF36Bb2dc525b1E566d6B42F6Fd1BB2035b89'

// 显式 stub（渲染真实元素，避免布尔 stub 空 fragment 的 refs=null 问题）
const stub = (name: string) => defineComponent({ name, render: () => h('div', { class: `stub-${name}` }) })

beforeEach(() => setActivePinia(createPinia()))

function mountIt(address: string) {
  return shallowMount(AddressDetail, {
    props: { address },
    global: {
      stubs: {
        JvPageState: stub('JvPageState'),
        JvHashText: stub('JvHashText'),
        JvAmount: stub('JvAmount'),
        JvLoading: stub('JvLoading'),
        WJOperations: stub('WJOperations'),
        CoreIdSection: stub('CoreIdSection'),
      },
      mocks: { $router: { push: vi.fn(), replace: vi.fn() } },
    },
  })
}

describe('AddressDetail 路由切换 watch', () => {
  it('初始 props.address=A → 显示 A；改 B → 显示 B（watch 生效）', async () => {
    const wrapper = mountIt(ADDR_A)
    // <script setup> 的 ref 不暴露到 vm，改断言 DOM 文本（第一个 .fmt-value = HEX 格式地址）
    expect(wrapper.find('.fmt-value').text()).toBe(ADDR_A)

    await wrapper.setProps({ address: ADDR_B })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.fmt-value').text()).toBe(ADDR_B)
    wrapper.unmount()
  })

  it('同一地址重复赋值不报错（幂等）', async () => {
    const wrapper = mountIt(ADDR_A)
    await wrapper.setProps({ address: ADDR_A })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.fmt-value').text()).toBe(ADDR_A)
    wrapper.unmount()
  })
})
