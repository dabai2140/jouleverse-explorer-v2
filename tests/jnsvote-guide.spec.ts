import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const mocks = vi.hoisted(() => ({ wallet: { address: null as string | null } }))
vi.mock('../src/stores/wallet', () => ({ useWalletStore: () => mocks.wallet }))

// 把 naive-ui 的折叠/标签页组件 mock 成「直接渲染插槽」，绕开 jsdom 里折叠/切换动画不可靠的问题，
// 只测本组件的业务逻辑：isSigner 判断 + 中性提示 + <ol> 参考清单。
vi.mock('naive-ui', () => {
  const NCollapse = (_props: any, ctx: any) => h('div', ctx.slots.default?.() ?? null)
  const NCollapseItem = (_props: any, ctx: any) => h('div', ctx.slots.default?.() ?? null)
  const NTabs = (_props: any, ctx: any) => h('div', ctx.slots.default?.() ?? null)
  const NTabPane = (props: any, ctx: any) => h('div', { 'data-pane': props.name }, ctx.slots.default?.() ?? null)
  return { NCollapse, NCollapseItem, NTabs, NTabPane }
})

import Guide from '../src/components/JNSVoteGuide.vue'
import { DECISION_RULE_DISPLAY } from '../src/utils/jnsvote-decision'

const SIGNER = '0x5bf50f2931688f886f46f88d5ceede530bb92076'

function render() {
  return mount(defineComponent({ setup() { return () => h(Guide) } }))
}

describe('JNSVoteGuide 使用指南组件', () => {
  it('非签名人展示中性 ℹ️ 提示（非 ⚠️）', () => {
    mocks.wallet.address = null
    const w = render()
    const tip = w.find('.guide-signer-tip')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('ℹ️')
    expect(tip.text()).not.toContain('⚠️')
    w.unmount()
  })

  it('签名人连接时不显示非签名人提示', () => {
    mocks.wallet.address = SIGNER
    const w = render()
    expect(w.find('.guide-signer-tip').exists()).toBe(false)
    w.unmount()
  })

  it('参考清单用 <ol> 渲染（非步骤条完成态）', () => {
    mocks.wallet.address = null
    const w = render()
    // 参与投票 + 多签创建提案两个清单
    expect(w.findAll('ol.guide-steps').length).toBe(2)
    // 不应再有 n-step 完成态节点
    expect(w.findAll('.n-step').length).toBe(0)
    w.unmount()
  })

  it('decisionRules 与 decision.ts 的 DECISION_RULE_DISPLAY 同源', () => {
    // Guide 的 decisionRules 直接引用 DECISION_RULE_DISPLAY，验证常量阈值与判定逻辑一致
    expect(DECISION_RULE_DISPLAY).toEqual([
      { rule: 'V1', scope: '提案 id ≤ 2', ar: '> 2/3', rr: '> 1/2' },
      { rule: 'V2', scope: '提案 id ≥ 3', ar: '> 2/3', rr: '> 0.4' },
    ])
  })
})
