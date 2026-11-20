/**
 * 能量金额双单位换算（v1 交易详情对等）
 *
 * v1 `transactionInfos.html` 对 gasPrice / 交易手续费都同时给两档：
 *   `{{gasPrice}} J (约 {{gasPriceGwei}} Gwei)`
 *   `{{txfee}} J (约 {{txfeeGwei}} Gwei)`
 * 换算关系写在页面脚注：`1 J = 1 Ewei = 10^9 Gwei = 10^18 wei`。
 *
 * v2 原来只用 `JvAmount` 给一档 J，缺 Gwei 这一档。这里补成纯函数：
 * 入参是 wei 原始值（bigint，避免精度丢失），输出两个字符串。
 *
 * ⚠️ 保持 bigint 运算，不用 Number()：
 * gasPrice 之类数值在 wei 量级常常超过 2^53，转 Number 会静默丢精度。
 * 只有最后格式化小数时才降到字符串层面的定点截断。
 */
import { formatUnits } from 'viem'

export interface DualUnitAmount {
  /** J 单位（18 位小数，去尾零） */
  j: string
  /** Gwei 单位（9 位小数，去尾零） */
  gwei: string
}

/** 去掉定点数尾部的 0 和小数点：'1.500' → '1.5'，'2.000' → '2' */
function trimFixed(value: string): string {
  if (!value.includes('.')) return value
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '')
  return trimmed.length === 0 ? '0' : trimmed
}

/**
 * wei → { j, gwei } 双单位字符串。
 *
 * @param wei 原始 wei 值
 * @param opts.jMaxDecimals   J 档最多保留几位小数（默认 9，足够显示 1 Gwei = 1e-9 J）
 * @param opts.gweiMaxDecimals Gwei 档最多保留几位小数（默认 6，链上 gasPrice 常是 .5 这类短小数）
 */
export function toDualUnit(
  wei: bigint | null | undefined,
  opts: { jMaxDecimals?: number; gweiMaxDecimals?: number } = {},
): DualUnitAmount | null {
  if (wei === null || wei === undefined) return null
  const raw = typeof wei === 'bigint' ? wei : BigInt(wei)
  if (raw < 0n) return null

  const jMax = opts.jMaxDecimals ?? 9
  const gweiMax = opts.gweiMaxDecimals ?? 6

  const j = trimFixed(truncateDecimals(formatUnits(raw, 18), jMax))
  const gwei = trimFixed(truncateDecimals(formatUnits(raw, 9), gweiMax))

  return { j, gwei }
}

/** 截断（不四舍五入）到最多 n 位小数，与 JvAmount 的行为保持一致 */
function truncateDecimals(value: string, n: number): string {
  if (n <= 0) return value.split('.')[0]
  const [intPart, fracPart = ''] = value.split('.')
  if (fracPart.length === 0) return intPart
  return `${intPart}.${fracPart.slice(0, n)}`
}

/**
 * 交易手续费 = gasUsed × gasPrice。
 *
 * 与视图里的计算同源，抽出来是为了能单测边界（gasUsed 为 0、gasPrice 为 0、超大值）。
 * 任一入参缺失返回 null —— 调用方据此显示「—」而不是 0，避免把「不知道」渲染成「免费」。
 */
export function computeTxFee(
  gasUsed: bigint | null | undefined,
  gasPrice: bigint | null | undefined,
): bigint | null {
  if (gasUsed === null || gasUsed === undefined) return null
  if (gasPrice === null || gasPrice === undefined) return null
  const used = typeof gasUsed === 'bigint' ? gasUsed : BigInt(gasUsed)
  const price = typeof gasPrice === 'bigint' ? gasPrice : BigInt(gasPrice)
  if (used < 0n || price < 0n) return null
  return used * price
}
