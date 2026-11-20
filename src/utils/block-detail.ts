/**
 * 区块详情页的纯逻辑（零 RPC / 零 DOM，可在 10ms 内测完）
 *
 * 对应 v1 `blockInfos.html` + `blockInfosController.js` 的两个字段：
 *   1. 确认数   —— controller:49-53 `conf = latest - blockNumber`（仅当 latest > blockNumber）
 *   2. 附加数据 extraData —— `hex2a(result.extraData)`
 *
 * 移植取舍（见 docs/v1-parity-checklist.md §五 判据）：
 *   - v1 的 `hex2a` 假定入参是「无 0x 前缀」的裸 hex（web3 0.x 行为）。
 *     viem 返回的是 `0x` 前缀，故本实现先剥前缀，再按字节解码。
 *   - v1 无条件把解出的字节塞进界面，遇到非可打印字节会显示控制字符。
 *     本实现区分「可读文本 / 不可读」，不可读时只给 null，由视图决定是否展示。
 *   - 确认数 v1 在 latest === blockNumber 时保持 0（不取负），本实现对负值一律钳到 0。
 */

const HEX_PREFIX = /^0x/i

/** 剥掉可选的 0x 前缀并转小写 */
function normalizeHex(hex: string): string | null {
  if (typeof hex !== 'string') return null
  const body = HEX_PREFIX.test(hex) ? hex.slice(2) : hex
  if (body.length === 0) return ''
  // 奇数长度或含非 hex 字符 → 不是合法字节串
  if (body.length % 2 !== 0) return null
  if (!/^[0-9a-fA-F]*$/.test(body)) return null
  return body.toLowerCase()
}

/** 可打印 ASCII（含空格与常见标点）+ 制表/换行算可读，其余控制字符不算 */
function isPrintableCode(code: number): boolean {
  return (code >= 0x20 && code <= 0x7e) || code === 0x09 || code === 0x0a || code === 0x0d
}

export interface DecodedHexText {
  /** 解出的文本；含不可打印字节时为 null */
  text: string | null
  /** 非可打印字节的个数（用于判断「这段 extraData 其实是二进制」） */
  nonPrintable: number
  /** 有效字节数 */
  bytes: number
}

/**
 * 把 `extraData` 这类 hex 字节串解成文本。
 * 返回结构而不是裸字符串，是为了让视图能区分：
 *   - 空（bytes === 0）        → 不展示
 *   - 纯可读（nonPrintable=0） → 展示文本
 *   - 含二进制字节             → 只展示 raw hex，不展示乱码
 */
export function decodeHexToText(hex: string | null | undefined): DecodedHexText {
  const empty: DecodedHexText = { text: null, nonPrintable: 0, bytes: 0 }
  if (!hex) return empty
  const body = normalizeHex(hex)
  if (body === null || body === '') return empty

  const bytes = body.length / 2
  let out = ''
  let nonPrintable = 0
  for (let i = 0; i < body.length; i += 2) {
    const code = parseInt(body.slice(i, i + 2), 16)
    if (Number.isNaN(code)) return empty
    if (isPrintableCode(code)) out += String.fromCharCode(code)
    else {
      nonPrintable++
      out += '\uFFFD'
    }
  }
  return { text: nonPrintable === 0 ? out : null, nonPrintable, bytes }
}

/**
 * 确认数 = 最新高度 - 该区块高度。
 * 未拿到最新高度（null）或区块尚未被打包（高度 >= 最新）时返回 0 —— 与 v1 的 `conf = 0` 初值一致。
 *
 * ⚠️ 必须用 bigint 做减法：先 Number() 再相减会在高度接近 2^53 时丢精度
 * （实测 9007199254740993n - 9007199254740990n 会被算成 992 而非 993）。
 * 当前链高度远小于该阈值，但把减法放在 bigint 侧是零成本的，不该留这种坑。
 */
export function confirmationCount(
  latestBlockNumber: bigint | number | null | undefined,
  blockNumber: bigint | number | null | undefined,
): number {
  if (latestBlockNumber === null || latestBlockNumber === undefined) return 0
  if (blockNumber === null || blockNumber === undefined) return 0

  const toBig = (v: bigint | number): bigint | null => {
    if (typeof v === 'bigint') return v
    if (!Number.isFinite(v)) return null
    if (!Number.isInteger(v)) return null
    return BigInt(v)
  }
  const latest = toBig(latestBlockNumber)
  const current = toBig(blockNumber)
  if (latest === null || current === null) return 0

  const diff = latest - current
  if (diff <= 0n) return 0
  // 返回 number 供视图直接显示；超出安全整数区间时按上限钳制而不是给出错值
  const asNumber = Number(diff)
  return Number.isSafeInteger(asNumber) ? asNumber : Number.MAX_SAFE_INTEGER
}

/**
 * 交易输入数据是否值得展示。v1 的判据是 `input && input !== '0x'`
 * （`blockInfos.html` 的 `ng-if="tx.input && tx.input !== '0x'"`）。
 * 纯转账的 input 是 `0x`，展示它只会占版面。
 */
export function hasInputData(input: string | null | undefined): boolean {
  if (!input) return false
  const body = HEX_PREFIX.test(input) ? input.slice(2) : input
  return body.length > 0
}

/** 长 hex 串按固定宽度折行展示（视图用，返回数组） */
export function chunkHex(hex: string, width = 64): string[] {
  if (!hex) return []
  if (width <= 0) return [hex]
  const out: string[] = []
  for (let i = 0; i < hex.length; i += width) out.push(hex.slice(i, i + width))
  return out
}
