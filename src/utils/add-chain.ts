/**
 * 一键添加 / 切换主网（v1 `switchNetwork()` 对等，EIP-3085 + EIP-3326）
 *
 * v1 `app/index.html:313-360` 的逻辑分两步，且第二步失败时才提示手工参数：
 *   1. `wallet_switchEthereumChain({ chainId: 0xe52 })`
 *   2. 抛 4902（未添加该链）→ `wallet_addEthereumChain({...})`
 *
 * v1 是「切换优先、失败再添加」，本实现同样顺序。理由：用户装了网络但没切换时，
 * 直接让他「添加」会得到一个重复网络条目，反而更乱。
 *
 * ⚠️ 参数按仓库 2026-10-29 的定调使用无端口正式端点：
 *    rpc = https://rpc.jnsdao.com（旧的 :8503 已废弃，不得出现在新代码里）
 *    ws  = wss://rpc.jnsdao.com/ws（EIP-3085 无 ws 字段，仅在提示文案里给）
 *
 * 本模块只负责「组装参数 + 调钱包」，不碰 Vue / 不碰 DOM，
 * 钱包 provider 由调用方注入，便于单测用假 provider 覆盖 4902 / 4001 各分支。
 */

/** EIP-3085 `wallet_addEthereumChain` 的参数体 */
export interface AddChainParams {
  chainId: string
  chainName: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

export const JOULEVERSE_CHAIN_ID_HEX = '0xe52' // 3666
export const JOULEVERSE_CHAIN_ID_DECIMAL = 3666

/** 与 src/config/chain.ts 同源的参数（此处独立声明是为了不引入依赖，便于纯函数测试） */
export const JOULEVERSE_ADD_CHAIN_PARAMS: AddChainParams = {
  chainId: JOULEVERSE_CHAIN_ID_HEX,
  chainName: 'Jouleverse',
  nativeCurrency: { name: 'Joule', symbol: 'J', decimals: 18 },
  rpcUrls: ['https://rpc.jnsdao.com'],
  blockExplorerUrls: ['https://jscan.jnsdao.com'],
}

/** 手工添加网络时给用户抄的参数（v1 在切换失败弹层的同款文案） */
export const MANUAL_CHAIN_HINT = {
  networkName: 'Jouleverse',
  rpcUrl: 'https://rpc.jnsdao.com',
  wsUrl: 'wss://rpc.jnsdao.com/ws',
  chainId: String(JOULEVERSE_CHAIN_ID_DECIMAL),
  symbol: 'J',
  explorer: 'https://jscan.jnsdao.com',
}

/** 最小 provider 接口：只要求 request，避免依赖 window.ethereum 的具体实现 */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export type AddChainOutcome =
  | { status: 'switched' }
  | { status: 'added' }
  | { status: 'no-provider' }
  | { status: 'rejected' }
  | { status: 'error'; code?: number; message: string }

/** EIP-1193 用户拒绝（点取消） */
const USER_REJECTED = 4001
/** 钱包不认识该链（需要先 addEthereumChain） */
const UNRECOGNIZED_CHAIN = 4902

function errorCode(e: unknown): number | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'number') return code
  }
  return undefined
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = (e as { message?: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return String(e)
}

/**
 * 切换（失败再添加）到 Jouleverse 主网。
 *
 * 返回结构化结果而不是抛异常：这是用户主动点按钮触发的流程，
 * 三种结局（切好 / 新增 / 用户取消）都是正常路径，视图据此给不同文案。
 */
export async function switchOrAddChain(provider: Eip1193Provider | null | undefined): Promise<AddChainOutcome> {
  if (!provider || typeof provider.request !== 'function') {
    return { status: 'no-provider' }
  }

  // 第一步：切换。已添加过该链时这一步就够了，不必再走 add。
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: JOULEVERSE_CHAIN_ID_HEX }],
    })
    return { status: 'switched' }
  } catch (switchError) {
    const code = errorCode(switchError)

    // 用户主动取消：不继续尝试添加，否则会再弹一次窗，像在纠缠用户
    if (code === USER_REJECTED) return { status: 'rejected' }

    // 未添加该链 → 走 EIP-3085 添加
    if (code === UNRECOGNIZED_CHAIN) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [JOULEVERSE_ADD_CHAIN_PARAMS],
        })
        return { status: 'added' }
      } catch (addError) {
        const addCode = errorCode(addError)
        if (addCode === USER_REJECTED) return { status: 'rejected' }
        return { status: 'error', code: addCode, message: errorMessage(addError) }
      }
    }

    return { status: 'error', code, message: errorMessage(switchError) }
  }
}

/** 结果 → 用户文案（保持 v1 的语气，同时明确「已添加」与「已切换」的区别） */
export function outcomeMessage(outcome: AddChainOutcome): string {
  switch (outcome.status) {
    case 'switched':
      return '已成功切换至 Jouleverse 区块链主网'
    case 'added':
      return '已成功添加 Jouleverse 区块链主网'
    case 'no-provider':
      return '未检测到钱包环境，请先安装或解锁钱包'
    case 'rejected':
      return '已取消操作'
    case 'error':
      return `操作失败（${outcome.code ?? '未知错误'}）：${outcome.message}`
  }
}
