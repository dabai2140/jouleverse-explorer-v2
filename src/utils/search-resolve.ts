// 全局搜索输入解析（纯函数，零 RPC / 零 DOM）
//
// 用途：把首页搜索框的原始字符串解析成「该跳到哪一类页面」。
//
// 对标基线：v1 `app/index.html:378-411 processRequest()`。逐行读过之后，
// 移植时**刻意与 v1 有三处不同**（都是 v1 的缺陷，不是对等目标）：
//
// 1. **区块哈希搜索不移植**。v1 的分支是：
//      else if (requestStr.length === 64) {
//        if (/[0-9a-zA-Z]{64}?/.test(requestStr)) return goToTxInfos(...)   // 几乎总是真
//        else if (/[0-9]{1,7}?/.test(requestStr)) return goToBlockInfos(...) // 永不可达
//      }
//    任何 64 位字符串都会命中第一个分支，所以 v1 会把区块哈希当交易哈希去查、
//    然后报「交易不存在」。那条 `else if` 是死代码 —— 详见
//    `docs/v1-parity-checklist.md` §二·二 的核实纠错注。**v1 从未真正支持区块哈希搜索**，
//    因此这不是对等缺口。要补也只能算 v2 的新功能。
//
// 2. **区块号必须全是数字**。v1 用 `parseInt(requestStr) > 0` 兜底，
//    于是 `12abc` 会被 parseInt 成 12 并跳去区块 12 —— 静默猜错。
//    这里要求 `/^\d+$/`，猜不出来就交给帮助弹层。
//
// 3. **无法识别时不静默跳转**。v1 弹「帮助」弹层列出 5 类示例；
//    v2 改动前是 `router.push('/block/<乱码>')`，用户会看到一个「区块不存在」的页面，
//    完全不知道自己错在哪。这里返回 `kind: 'unknown'` + 原因码，由视图弹帮助。
//
// 顺序很关键：v1 的顺序是 `.j` → `j3…` → 40 位 → 64 位 → 数字。
// 尤其是 **40 位 hex 必须排在「纯数字」之前** —— 否则 40 位全数字地址
// （如 `1234567890…`，合法 hex 地址）会被当成区块号。v2 改动前正是这个顺序 bug。

import { detectAddressFormat, decodeJVA } from './jvaddress'

export type SearchKind = 'jns' | 'tx' | 'address' | 'block' | 'unknown'

/** `unknown` 的原因码：用于给出「你是哪里写错了」的具体提示，而不是笼统说「无效」 */
export type SearchUnknownReason =
  | 'empty' // 空输入
  | 'invalid-jva' // j3 开头但 JVA/B32 解码失败（校验和不符 / 长度不对）
  | 'unrecognized' // 五类都不匹配

export interface SearchResolution {
  kind: SearchKind
  /**
   * 规范化后的目标值。
   * - `tx` / `address`：带 `0x` 前缀的规范形式（地址保持原大小写，JVA 已解码成 hex）
   * - `jns`：含 `.j` 后缀的域名
   * - `block`：去掉前导零的十进制字符串（`0` 保留）
   * - `unknown`：原始输入（trim 后）
   */
  value: string
  /** 仅 `kind === 'unknown'` 时存在 */
  reason?: SearchUnknownReason
}

/** 去掉所有空白（v1 也是这么做的：用户从别处粘贴时常带空格） */
const stripWhitespace = (s: string) => s.replace(/\s/g, '')

/**
 * 解析搜索框输入。
 *
 * @example
 * resolveSearchInput('love.j')            // → { kind: 'jns', value: 'love.j' }
 * resolveSearchInput('0x3D86…7a20c')      // → { kind: 'address', value: '0x3D86…' }
 * resolveSearchInput('3D86…7a20c')        // → { kind: 'address', value: '0x3D86…' }  (40 位无前缀)
 * resolveSearchInput('0xe397…a830')       // → { kind: 'tx', value: '0xe397…' }
 * resolveSearchInput('1011228')           // → { kind: 'block', value: '1011228' }
 * resolveSearchInput('hello')             // → { kind: 'unknown', reason: 'unrecognized' }
 */
export function resolveSearchInput(raw: string): SearchResolution {
  const input = stripWhitespace(raw ?? '')

  if (input === '') {
    return { kind: 'unknown', value: '', reason: 'empty' }
  }

  // 1) JNS 域名：以 .j 结尾（大小写不敏感，v1 用 /\.j$/)
  if (/\.j$/i.test(input)) {
    return { kind: 'jns', value: input }
  }

  // 2) JVA / B32：j3 开头。必须先于 40 位 hex 判断（'j' 不是 hex 字符，
  //    但顺序上仍然先判更贴近 v1，也便于给出「JVA 解码失败」这种精确提示）
  if (/^j3/i.test(input)) {
    const format = detectAddressFormat(input)
    if (format === 'b32' || format === 'full') {
      const decoded = decodeJVA(input)
      if (decoded.success) {
        return { kind: 'address', value: decoded.hexAddress }
      }
    }
    return { kind: 'unknown', value: input, reason: 'invalid-jva' }
  }

  // 3) 剥掉单个前导 0x —— v1 用 `split('0x').join('')` 剥掉**所有**出现的 0x，
  //    对 `0xabc0xdef` 这种畸形输入会拼出一个原本不存在的串。这里只认前导前缀。
  const bare = /^0x/i.test(input) ? input.slice(2) : input

  // 4) 40 位 hex → 地址（**必须早于「纯数字」分支**，见文件头说明）
  if (/^[0-9a-f]{40}$/i.test(bare)) {
    return { kind: 'address', value: `0x${bare}` }
  }

  // 5) 64 位 hex → 交易哈希（v1 同：长度 64 一律走 tx）
  if (/^[0-9a-f]{64}$/i.test(bare)) {
    return { kind: 'tx', value: `0x${bare}` }
  }

  // 6) 纯十进制 → 区块高度。允许 0（创世块确实存在，v1 的 `> 0` 把它排除了）
  if (/^\d+$/.test(bare)) {
    const normalized = bare.replace(/^0+(?=\d)/, '')
    return { kind: 'block', value: normalized }
  }

  return { kind: 'unknown', value: input, reason: 'unrecognized' }
}

/** 搜索框下方的帮助示例（与 v1 弹层同源，但换成真实可查的样本） */
export interface SearchHelpExample {
  label: string
  example: string
}

export const SEARCH_HELP_EXAMPLES: readonly SearchHelpExample[] = [
  { label: '区块高度', example: '1011228' },
  {
    // 换成链上真实存在的交易（块 8664408，带 calldata）。
    // v1 帮助弹层里那个 0xe3978e82… 在链上查不到 —— 照抄会给出点不动的示例。
    label: '交易哈希',
    example: '0x76c241e5e0e25e15728e8c39a6ccf56d97cd2eacbb1b0bd525533c901809802f',
  },
  { label: '链地址（HEX）', example: '0x3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20c' },
  { label: '链地址（B32）', example: 'j38krd65xz7vea84ua5t0xhn2hq6ka0gsv2er7ar' },
  { label: 'JNS 域名', example: 'love.j' },
] as const
