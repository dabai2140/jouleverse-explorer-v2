/**
 * 输入数据 ABI 解码（v1 `decodeInput()` 对等）
 *
 * v1 `transactionInfosController.js:132-143` 用 `abi-decoder.js` 注册 12 份 ABI
 * （wj / redpacket / pop / planet / jvcore / jti2 / jti / jnsvote / jns / flyingj / airdrop），
 * 交易详情页「输入数据」可在「原始数据 ←→ ABI 解码」之间切换。
 *
 * v2 的 ABI 已经全在 `src/contracts/toolbox.ts`（12 个合约，含 jnsdaov / cryptojunks / timelock / multisig）。
 * 本模块把它们聚合成一张「4 字节选择器 → 解码器」索引，用 viem 的 `decodeFunctionData` 解。
 *
 * 设计要点：
 * 1. **纯函数、零 RPC 零 DOM** —— 符合 AGENTS.md 原则五「10 毫秒能测完的逻辑别埋在组件里」。
 * 2. **选择器索引而不是逐个 try**。12 份 ABI 逐个人肉试错在 UI 里会被反复调用，
 *    先按选择器命中、再解码，未命中直接返回 null（v1 也是这个语义：解不出就保持原始数据）。
 * 3. **不做「解码成功就一定是该合约」的推断**。选择器碰撞（4 字节）概率极低但存在，
 *    所以返回体里带上 contractName，视图层可以选择显示「按 X 的 ABI 解出」，把不确定性暴露给用户。
 * 4. **失败静默返回 null**。解码是「增强信息」，不能因为解不出就让整个交易页报错。
 */
import { decodeFunctionData, toFunctionSelector, type Abi, type AbiFunction } from 'viem'
import { toolboxContracts } from '../contracts/toolbox'

export interface DecodedArg {
  /** 参数名；ABI 未命名时为空字符串 */
  name: string
  /** solidity 类型，如 `address` / `uint256` / `bytes` */
  type: string
  /** 展示用字符串（bigint → 十进制串，数组 → JSON，其余 String()） */
  value: string
}

export interface DecodedInput {
  /** 命中的合约名（toolbox 里的 `name`） */
  contractName: string
  /** 命中的合约 key，可跳 `/tools/contract/:key` */
  contractKey: string
  /** 函数名 */
  functionName: string
  /** 函数签名，如 `transfer(address,uint256)` */
  signature: string
  /** 仅参数类型串，如 `address,uint256`（视图里拼在函数名后面的括号里） */
  argTypes: string
  /** 4 字节选择器（带 0x） */
  selector: string
  /** 按 ABI 顺序的参数 */
  args: DecodedArg[]
}

interface Entry {
  contractName: string
  contractKey: string
  abi: Abi
  fn: AbiFunction
}

let selectorIndex: Map<string, Entry[]> | null = null

/** bigint / bytes / 数组 → 可读字符串。不做单位换算（金额换算由视图决定）。 */
function renderValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return JSON.stringify(value.map(v => (typeof v === 'bigint' ? v.toString() : v)))
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  }
  return String(value)
}

function buildIndex(): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  for (const contract of toolboxContracts) {
    const abi = contract.abi as Abi
    for (const item of abi) {
      if (item.type !== 'function') continue
      const fn = item as AbiFunction
      // 只有带 inputs 的 function 才可能出现在 calldata 里；
      // 但无参函数（如 `deposit()`）也会产生纯选择器 calldata，所以不能按 inputs 长度过滤。
      let selector: string
      try {
        selector = toFunctionSelector(fn)
      } catch {
        continue // ABI 条目异构（老 ABI 缺字段）时跳过，不让单条脏数据废掉整张表
      }
      const list = map.get(selector) ?? []
      // 选择器碰撞：同一选择器可能来自不同合约，全部保留，解码时逐个试
      list.push({ contractName: contract.name, contractKey: contract.key, abi, fn })
      map.set(selector, list)
    }
  }
  return map
}

/** 取 calldata 的前 4 字节选择器；非 hex 或长度不足返回 null */
export function extractSelector(input: string | null | undefined): string | null {
  if (!input) return null
  const lower = input.trim().toLowerCase()
  if (!lower.startsWith('0x')) return null
  if (lower.length < 10) return null // 0x + 4 字节 = 10 个字符
  return lower.slice(0, 10)
}

/**
 * 解 calldata。
 *
 * 返回 null 的情形（都属正常，视图保持「原始数据」展示）：
 * - 空输入 / `0x` / 纯转账（无选择器）
 * - 选择器不在已注册的 12 份 ABI 内
 * - 命中选择器但参数区长度与 ABI 不符（解码抛错）
 */
export function decodeInput(input: string | null | undefined): DecodedInput | null {
  const selector = extractSelector(input)
  if (!selector) return null
  if (!selectorIndex) selectorIndex = buildIndex()

  const candidates = selectorIndex.get(selector)
  if (!candidates || candidates.length === 0) return null

  const data = input!.trim() as `0x${string}`

  for (const entry of candidates) {
    try {
      const decoded = decodeFunctionData({ abi: entry.abi, data })
      const inputs = entry.fn.inputs ?? []
      const values = (decoded.args ?? []) as readonly unknown[]
      const args: DecodedArg[] = inputs.map((param, i) => ({
        name: param.name ?? '',
        type: param.type ?? '',
        value: renderValue(values[i]),
      }))
      const argTypes = inputs.map(p => p.type).join(',')
      const signature = `${entry.fn.name}(${argTypes})`
      return {
        contractName: entry.contractName,
        contractKey: entry.contractKey,
        functionName: entry.fn.name,
        signature,
        argTypes,
        selector,
        args,
      }
    } catch {
      // 该候选解不出（参数区不匹配），试下一个同选择器的候选
    }
  }
  return null
}

/** 供测试重置惰性索引（生产代码不需要调用） */
export function __resetDecodeIndex(): void {
  selectorIndex = null
}
