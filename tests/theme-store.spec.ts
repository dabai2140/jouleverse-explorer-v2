// src/stores/theme.ts 冒烟/行为测试（issue #55）
// 目的：让 tests/setup.ts 里那段 matchMedia mock 有真实的消费者。
// 背景（见 PR #54）：jsdom 从未实现 window.matchMedia，而 theme store 在初始化时即调用它。
// 此前没有任何 spec 真的初始化 useThemeStore，于是那段 mock 成了无人使用的防御性代码——
// 一旦被误删或改坏，CI 也不会红。本文件锁定该路径。
//
// ⚠️ 设计约束：前两条「初始化」用例**不得**自行安装 matchMedia mock，
// 必须完全依赖 tests/setup.ts。这样一旦 setup.ts 的 mock 被误删/改坏，
// 本文件立刻变红（已做过反证：删掉 setup.ts 的 mock → 这两条 FAIL）。
// 其余用例用 spyOn 显式控制 matches / 事件回调，属于对场景的主动编排。
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { darkTheme } from 'naive-ui'

import { useThemeStore } from '@/stores/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** tests/setup.ts 安装的 matchMedia mock（vi.fn） */
function setupMock() {
  return window.matchMedia as unknown as Mock
}

/**
 * 用统一 mql 实例覆盖 matchMedia，便于拿到 theme store 注册的 change 回调。
 * theme store 会调用两次 matchMedia（取 .matches 一次、注册监听一次），
 * 这里让两次都返回同一个对象，断言才稳定。
 */
function stubMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: DARK_QUERY,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList)
  return mql
}

/** 取 theme store 注册的 change 监听器 */
function getChangeHandler(mql: ReturnType<typeof stubMatchMedia>) {
  const call = mql.addEventListener.mock.calls.find(([type]) => type === 'change')
  if (!call) throw new Error('theme store 未注册 matchMedia change 监听器')
  return call[1] as (e: { matches: boolean }) => void
}

function createThemeStore(theme?: 'light' | 'dark' | 'system') {
  if (theme) localStorage.setItem('jv-theme', theme)
  setActivePinia(createPinia())
  return useThemeStore()
}

beforeEach(() => {
  // 还原 spyOn（回到 tests/setup.ts 安装的 mock），并清空调用记录
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  setupMock()?.mockClear?.()
})

describe('theme store 初始化（#55 覆盖盲区）', () => {
  it('依赖 tests/setup.ts 的 mock 能初始化成功（mock 被真实消费）', () => {
    // 本用例不装 mock —— 若 setup.ts 的 matchMedia mock 缺失/失效，这里直接抛
    // TypeError: window.matchMedia is not a function，正是 #55 要守的门。
    const store = createThemeStore()

    expect(typeof window.matchMedia).toBe('function')
    expect(store.mode).toBe('system')
    expect(store.isDark).toBe(false)
    // setup.ts 的 mock 默认 matches: false，且 store 初始化确实走过了它
    expect(setupMock().mock.calls.length).toBeGreaterThan(0)
    expect(setupMock()).toHaveBeenCalledWith(DARK_QUERY)
  })

  it('localStorage 无 jv-theme 时默认为 system，并写入 data-theme = system', async () => {
    const store = createThemeStore()
    await nextTick()

    expect(store.mode).toBe('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('system')
  })
})

describe('theme store 三态取值', () => {
  it("jv-theme = 'dark' → isDark true、naiveTheme 为 darkTheme、data-theme = dark", async () => {
    stubMatchMedia(false)
    const store = createThemeStore('dark')
    await nextTick()

    expect(store.mode).toBe('dark')
    expect(store.isDark).toBe(true)
    expect(store.naiveTheme).toBe(darkTheme)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it("jv-theme = 'light' → isDark false、naiveTheme 为 null、data-theme = light", async () => {
    stubMatchMedia(true) // 即使系统是深色，显式 light 也必须压过它
    const store = createThemeStore('light')
    await nextTick()

    expect(store.mode).toBe('light')
    expect(store.isDark).toBe(false)
    expect(store.naiveTheme).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it("jv-theme = 'system' → 读取 matchMedia 的 matches（true 时 isDark 为 true）", async () => {
    stubMatchMedia(true)
    const store = createThemeStore('system')
    await nextTick()

    expect(store.mode).toBe('system')
    expect(store.isDark).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('system')
  })

  it('system 模式下系统主题切换会同步 isDark', async () => {
    const mql = stubMatchMedia(false)
    const store = createThemeStore('system')
    await nextTick()
    expect(store.isDark).toBe(false)

    getChangeHandler(mql)({ matches: true })
    await nextTick()
    expect(store.isDark).toBe(true)

    getChangeHandler(mql)({ matches: false })
    await nextTick()
    expect(store.isDark).toBe(false)
  })
})

describe('theme store 写操作', () => {
  it('setMode 同步 localStorage 与 data-theme', async () => {
    stubMatchMedia(false)
    const store = createThemeStore('light')
    await nextTick()

    store.setMode('dark')
    await nextTick()

    expect(store.isDark).toBe(true)
    expect(localStorage.getItem('jv-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggle 在 light 下切到 dark，再次 toggle 切回 light', async () => {
    stubMatchMedia(false)
    const store = createThemeStore('light')
    await nextTick()

    store.toggle()
    await nextTick()
    expect(store.mode).toBe('dark')
    expect(localStorage.getItem('jv-theme')).toBe('dark')

    store.toggle()
    await nextTick()
    expect(store.mode).toBe('light')
    expect(localStorage.getItem('jv-theme')).toBe('light')
  })
})

describe('theme store 销毁清理', () => {
  it('$dispose 时移除 matchMedia change 监听器（onScopeDispose 路径）', () => {
    const mql = stubMatchMedia(false)
    const store = createThemeStore()
    const handler = getChangeHandler(mql)

    expect(mql.removeEventListener).not.toHaveBeenCalled()

    store.$dispose()

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', handler)
  })
})
