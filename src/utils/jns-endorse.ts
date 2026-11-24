// JNS 打赏（endorse）金额与 DID 域名规范化 —— 纯函数，无 RPC
//
// v1 基准（`jnsInfoController.js` 的 endorseJNSAmountDialog / endorseJNSConfirmDialog）：
//   - 快选 1 / 2 / 5 / 10 WJ，或「手动输入」
//   - 手动输入框提示「大于0小于100 WJ」，校验写成 `<= 0 || > 100` 才拦
//     → 边界是 **0 < x ≤ 100**（100 是允许的，v1 弹窗文案写「小于100」是文案自身的错）
//   - `Number.isNaN(amount) || amount <= 0 || amount > 100` → 报错
//   - 通过 `web3.utils.toWei(amount.toString(), 'ether')` 转 wei
//
// ⚠️ 为什么不用 Number 做金额：
//   v1 用 parseFloat + toWei(String)，`0.1` 这类值靠 toWei 内部字符串解析才不出错。
//   这里直接按字符串切小数位构造 bigint，避免任何浮点往返。

/** v1 快选档位（WJ） */
export const ENDORSE_PRESETS = [1, 2, 5, 10] as const

/** 打赏上限（WJ） */
export const MAX_ENDORSE_WJ = 100

/** wei 的十进制位数 */
const WEI_DECIMALS = 18

export interface EndorseAmountOk {
  ok: true
  /** 转好的 wei */
  wei: bigint
  /** 规范化后的 WJ 字符串（去尾零、去前导零），用于回显与二次确认 */
  wj: string
}

export interface EndorseAmountErr {
  ok: false
  error: string
}

export type EndorseAmountResult = EndorseAmountOk | EndorseAmountErr

/** 去掉小数尾部的 0，以及多余的 `.`（"1.500" → "1.5"，"2.000" → "2"） */
function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  const trimmed = s.replace(/0+$/, '').replace(/\.$/, '')
  return trimmed === '' ? '0' : trimmed
}

/** 去掉整数部分的前导 0（保留单个 "0"） */
function stripLeadingZeros(s: string): string {
  return s.replace(/^0+(?=\d)/, '')
}

/**
 * 校验并转换打赏金额。
 *
 * 边界严格对齐 v1：**0 < x ≤ 100**，否则报错（不静默截断、不自动夹到上限）。
 * 允许小数（v1 注释写明 `// float number allowed`），最多 18 位小数。
 *
 * 上限比较用 bigint 而不是 Number：`100.000000000000000001` 这种输入
 * 转 Number 会变成 100 而放过去，bigint 才拦得住。
 *
 * @param raw 用户输入或快选档位（字符串或数字都接受，统一按字符串解析）
 */
export function parseEndorseAmount(raw: string | number | null | undefined): EndorseAmountResult {
  if (raw === null || raw === undefined) {
    return { ok: false, error: '请填写打赏金额' }
  }
  // 数字转字符串走 String() 而不是模板拼接，避免 NaN 记号污染
  const text = (typeof raw === 'number' ? String(raw) : raw).trim()

  if (text === '') {
    return { ok: false, error: '请填写打赏金额' }
  }

  // 只接受「整数」或「整数.整数」；拒绝科学计数法、正负号、千分位、内嵌空格
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, error: '金额格式无效，请输入正数' }
  }

  const [intPartRaw, fracPart = ''] = text.split('.')

  if (fracPart.length > WEI_DECIMALS) {
    return { ok: false, error: `金额最多 ${WEI_DECIMALS} 位小数` }
  }

  const intPart = stripLeadingZeros(intPartRaw)
  const wj = trimTrailingZeros(fracPart ? `${intPart}.${fracPart}` : intPart)

  // 拼 wei：整数位 + 补齐到 18 位的小数位
  const wei = BigInt(`${intPart}${fracPart.padEnd(WEI_DECIMALS, '0')}`)

  if (wei <= 0n) {
    return { ok: false, error: '打赏金额须大于 0' }
  }

  if (wei > BigInt(MAX_ENDORSE_WJ) * 10n ** BigInt(WEI_DECIMALS)) {
    return { ok: false, error: `打赏金额须不超过 ${MAX_ENDORSE_WJ} WJ` }
  }

  return { ok: true, wei, wj }
}

/**
 * 域名输入规范化（DID 页 `/did/:jnsId` 用）。
 *
 * v1 的两处特例（`addressInfoController.js` 与 `jnsInfoController.js` 各写了一遍）：
 *   `if (id == "gm.j") id = "GM.j";` / `if (id == "nana.j") id = "Nana.j";`
 * 这两个域名在链上是大小写混合的，而 v1 路由参数被 `toLowerCase()` 拍平过，
 * 必须还原，否则 `_nslookup` 查不到。
 *
 * @returns 规范化后的 `.j` 域名；格式不对返回 null
 */
export function normalizeJnsId(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const lower = trimmed.toLowerCase()
  if (!lower.endsWith('.j')) return null

  const name = lower.slice(0, -2)
  if (name === '') return null
  // 与 v1 mint 的名称字符集一致：大小写字母、数字、中横线
  if (!/^[a-z0-9-]+$/.test(name)) return null

  // 链上真实大小写特例
  if (lower === 'gm.j') return 'GM.j'
  if (lower === 'nana.j') return 'Nana.j'

  return lower
}

/**
 * 从 `.j` 域名取裸名字（`_nslookup` 的入参）。
 * `normalizeJnsId` 之后调用，因此保留大小写特例。
 */
export function jnsNameOf(jnsId: string): string {
  return jnsId.endsWith('.j') ? jnsId.slice(0, -2) : jnsId
}

/**
 * JNS mint 的名称校验（v1 `mintJNS` 的两道前置检查）。
 * 顺序与 v1 一致：先判 `.j` 结尾，再判字符集。
 */
export function validateMintName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = (raw || '').trim()
  if (!trimmed.toLowerCase().endsWith('.j') || trimmed.length <= 2) {
    return { ok: false, error: `错误：JNS 名称 ${trimmed} 必须以 .j 结尾` }
  }
  const name = trimmed.slice(0, -2)
  if (!/^[a-zA-Z0-9-]+$/.test(name)) {
    return { ok: false, error: `错误：JNS 名称 ${trimmed} 只可以包含大小写字母、数字以及中横线` }
  }
  return { ok: true, name }
}

/**
 * 是否应显示 owner-only 的 mint 入口。
 * v1 条件：`chainId == '0xe52' && account == jnsContractOwner`（且该域名不存在）。
 * 地址比较一律小写 —— v1 模板里是 `account.toLowerCase() == jnsContractOwner.toLowerCase()`
 * （addressInfo.html 那处漏了，但 jnsInfo.html 有）。这里统一小写，避免校验和大小写差异。
 */
export function canMintJns(params: {
  connectedAccount: string | null | undefined
  contractOwner: string | null | undefined
  chainId: number | null | undefined
  /** 该域名是否已存在（存在则不需要 mint 入口） */
  exists: boolean
}): boolean {
  const { connectedAccount, contractOwner, chainId, exists } = params
  if (exists) return false
  if (chainId !== 3666) return false
  if (!connectedAccount || !contractOwner) return false
  if (!connectedAccount.startsWith('0x') || !contractOwner.startsWith('0x')) return false
  return connectedAccount.toLowerCase() === contractOwner.toLowerCase()
}
