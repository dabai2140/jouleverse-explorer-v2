import { describe, expect, it, vi } from 'vitest'
import {
  switchOrAddChain,
  outcomeMessage,
  JOULEVERSE_ADD_CHAIN_PARAMS,
  JOULEVERSE_CHAIN_ID_HEX,
  JOULEVERSE_CHAIN_ID_DECIMAL,
  MANUAL_CHAIN_HINT,
  type Eip1193Provider,
} from '../src/utils/add-chain'

/** 假 provider：按预设脚本逐次返回/抛错，并记录被调用的方法序列 */
function fakeProvider(script: Array<{ ok: true; value?: unknown } | { ok: false; error: unknown }>) {
  const calls: string[] = []
  let i = 0
  const provider: Eip1193Provider = {
    request: vi.fn(async ({ method }: { method: string }) => {
      calls.push(method)
      const step = script[i++]
      if (!step) throw new Error(`unexpected call #${i}: ${method}`)
      if (step.ok) return step.value
      throw step.error
    }),
  }
  return { provider, calls }
}

describe('switchOrAddChain — 已添加该链', () => {
  it('切换成功 → status=switched，且不调用 addEthereumChain', async () => {
    const { provider, calls } = fakeProvider([{ ok: true }])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'switched' })
    expect(calls).toEqual(['wallet_switchEthereumChain'])
  })

  it('切换时带的 chainId 是 0xe52（3666）', async () => {
    const { provider } = fakeProvider([{ ok: true }])
    await switchOrAddChain(provider)
    const req = (provider.request as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(req.method).toBe('wallet_switchEthereumChain')
    expect(req.params).toEqual([{ chainId: '0xe52' }])
  })
})

describe('switchOrAddChain — 未添加该链（4902）', () => {
  it('先切换失败 4902 → 自动 addEthereumChain，返回 added', async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error: { code: 4902, message: 'Unrecognized chain ID' } },
      { ok: true },
    ])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'added' })
    expect(calls).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain'])
  })

  it('add 时传的参数是 EIP-3085 完整结构，且 rpc 用无端口正式端点', async () => {
    const { provider } = fakeProvider([
      { ok: false, error: { code: 4902, message: 'Unrecognized chain ID' } },
      { ok: true },
    ])
    await switchOrAddChain(provider)
    const addReq = (provider.request as ReturnType<typeof vi.fn>).mock.calls[1][0]
    expect(addReq.method).toBe('wallet_addEthereumChain')
    const params = addReq.params[0]
    expect(params.chainId).toBe('0xe52')
    expect(params.chainName).toBe('Jouleverse')
    expect(params.nativeCurrency).toEqual({ name: 'Joule', symbol: 'J', decimals: 18 })
    expect(params.rpcUrls).toEqual(['https://rpc.jnsdao.com'])
    expect(params.blockExplorerUrls).toEqual(['https://jscan.jnsdao.com'])
  })

  it('参数里绝不含已废弃的 :8503 / :8505 端口（2026-10-29 定调）', async () => {
    const serialized = JSON.stringify(JOULEVERSE_ADD_CHAIN_PARAMS)
    expect(serialized).not.toContain(':8503')
    expect(serialized).not.toContain(':8505')
    const hint = JSON.stringify(MANUAL_CHAIN_HINT)
    expect(hint).not.toContain(':8503')
    expect(hint).not.toContain(':8505')
  })

  it('add 时用户取消 → rejected（不再循环弹窗）', async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error: { code: 4902, message: 'Unrecognized chain ID' } },
      { ok: false, error: { code: 4001, message: 'User rejected' } },
    ])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'rejected' })
    expect(calls).toHaveLength(2)
  })

  it('add 失败（非取消）→ error 且带 code 与 message', async () => {
    const { provider } = fakeProvider([
      { ok: false, error: { code: 4902, message: 'Unrecognized chain ID' } },
      { ok: false, error: { code: -32603, message: 'Internal error' } },
    ])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'error', code: -32603, message: 'Internal error' })
  })
})

describe('switchOrAddChain — 用户取消与其它错误', () => {
  it('切换时用户点取消（4001）→ rejected，不尝试 add（避免再次弹窗纠缠）', async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error: { code: 4001, message: 'User rejected the request' } },
    ])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'rejected' })
    expect(calls).toEqual(['wallet_switchEthereumChain'])
  })

  it('其它错误码（非 4902/4001）→ error，不尝试 add', async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error: { code: -32000, message: 'Some other failure' } },
    ])
    const r = await switchOrAddChain(provider)
    expect(r).toEqual({ status: 'error', code: -32000, message: 'Some other failure' })
    expect(calls).toHaveLength(1)
  })

  it('Error 实例（无 code）也能取到 message', async () => {
    const { provider } = fakeProvider([{ ok: false, error: new Error('boom') }])
    const r = await switchOrAddChain(provider)
    expect(r.status).toBe('error')
    expect(r.status === 'error' && r.message).toBe('boom')
  })
})

describe('switchOrAddChain — 无钱包环境', () => {
  it('provider 为 null / undefined → no-provider，不抛错', async () => {
    expect(await switchOrAddChain(null)).toEqual({ status: 'no-provider' })
    expect(await switchOrAddChain(undefined)).toEqual({ status: 'no-provider' })
  })

  it('provider 存在但没有 request 方法 → no-provider', async () => {
    expect(await switchOrAddChain({} as Eip1193Provider)).toEqual({ status: 'no-provider' })
  })
})

describe('常量一致性', () => {
  it('chainId 的 hex 与 decimal 指同一条链', () => {
    expect(parseInt(JOULEVERSE_CHAIN_ID_HEX, 16)).toBe(JOULEVERSE_CHAIN_ID_DECIMAL)
    expect(JOULEVERSE_CHAIN_ID_DECIMAL).toBe(3666)
  })

  // 回归用例（2026-11-20 教链指出）：钱包里已按「Jouleverse」建过网络，
  // 而 wallet_addEthereumChain 传「Jouleverse Mainnet」会被当成另一条新链再添一遍。
  // 锁死网络名为「Jouleverse」，不要带 Mainnet 后缀。
  it('网络名是「Jouleverse」，不带 Mainnet 后缀', () => {
    expect(JOULEVERSE_ADD_CHAIN_PARAMS.chainName).toBe('Jouleverse')
    expect(JOULEVERSE_ADD_CHAIN_PARAMS.chainName).not.toContain('Mainnet')
    expect(MANUAL_CHAIN_HINT.networkName).toBe('Jouleverse')
    expect(MANUAL_CHAIN_HINT.networkName).not.toContain('Mainnet')
  })

  it('RPC 是不带显式端口的正式端点（不能出现 :8503 / :8505 或其它端口）', () => {
    for (const url of [...JOULEVERSE_ADD_CHAIN_PARAMS.rpcUrls, MANUAL_CHAIN_HINT.rpcUrl, MANUAL_CHAIN_HINT.wsUrl]) {
      const { protocol, host, port } = new URL(url)
      expect(['https:', 'wss:']).toContain(protocol)
      expect(host).toBe('rpc.jnsdao.com')
      expect(port, `${url} 不应带显式端口`).toBe('')
    }
    expect(JOULEVERSE_ADD_CHAIN_PARAMS.rpcUrls).toEqual(['https://rpc.jnsdao.com'])
    expect(MANUAL_CHAIN_HINT.wsUrl).toBe('wss://rpc.jnsdao.com/ws')
  })

  it('手工提示里的参数与 EIP-3085 参数同源（不会出现两处不一致）', () => {
    expect(MANUAL_CHAIN_HINT.rpcUrl).toBe(JOULEVERSE_ADD_CHAIN_PARAMS.rpcUrls[0])
    expect(MANUAL_CHAIN_HINT.explorer).toBe(JOULEVERSE_ADD_CHAIN_PARAMS.blockExplorerUrls[0])
    expect(MANUAL_CHAIN_HINT.networkName).toBe(JOULEVERSE_ADD_CHAIN_PARAMS.chainName)
    expect(MANUAL_CHAIN_HINT.symbol).toBe(JOULEVERSE_ADD_CHAIN_PARAMS.nativeCurrency.symbol)
    expect(MANUAL_CHAIN_HINT.chainId).toBe(String(JOULEVERSE_CHAIN_ID_DECIMAL))
  })
})

describe('outcomeMessage — 每种结局都有可读文案', () => {
  it.each([
    [{ status: 'switched' } as const, '已成功切换至 Jouleverse 区块链主网'],
    [{ status: 'added' } as const, '已成功添加 Jouleverse 区块链主网'],
    [{ status: 'no-provider' } as const, '未检测到钱包环境，请先安装或解锁钱包'],
    [{ status: 'rejected' } as const, '已取消操作'],
  ])('%j → %s', (outcome, expected) => {
    expect(outcomeMessage(outcome)).toBe(expected)
  })

  it('error 结局带上错误码与消息（用户能据此查原因）', () => {
    expect(outcomeMessage({ status: 'error', code: 4902, message: 'nope' })).toBe('操作失败（4902）：nope')
  })

  it('error 缺 code 时显示「未知错误」而不是 undefined', () => {
    const msg = outcomeMessage({ status: 'error', message: 'nope' })
    expect(msg).toContain('未知错误')
    expect(msg).not.toContain('undefined')
  })
})
