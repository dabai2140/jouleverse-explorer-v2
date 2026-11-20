// 全局搜索输入解析用例（纯函数，零 RPC / 零 DOM，毫秒级）
//
// 对应 docs/v1-parity-checklist.md §三·A 第 3 项「全局搜索补全」。
// v1 基线：app/index.html:378-411 processRequest()。
//
// 这个文件的作用不只是「跑绿」，而是把下面三件事钉死：
//   ① 40 位 hex 地址必须先于「纯数字」判断 —— 否则 40 位全数字地址被当区块号（v2 原 bug）
//   ② 区块哈希搜索**不移植** —— v1 那条分支永不可达，是死代码（见 utils/search-resolve.ts 头注释）
//   ③ 无法识别时返回 unknown + 原因码，不静默跳 /block/<乱码>（v2 原 bug）
import { describe, it, expect } from 'vitest'
import {
  resolveSearchInput,
  SEARCH_HELP_EXAMPLES,
  type SearchResolution,
} from '../src/utils/search-resolve'

const kindOf = (raw: string) => resolveSearchInput(raw).kind
const valueOf = (raw: string) => resolveSearchInput(raw).value

describe('resolveSearchInput — JNS 域名', () => {
  it('.j 结尾识别为 jns', () => {
    expect(resolveSearchInput('love.j')).toEqual<SearchResolution>({ kind: 'jns', value: 'love.j' })
  })

  it('.J 大写后缀同样识别（v1 用 /\.j$/)', () => {
    expect(kindOf('Love.J')).toBe('jns')
  })

  it('域名中间含空格时先剥离空白', () => {
    expect(valueOf(' love.j ')).toBe('love.j')
  })

  it('不以 .j 结尾的普通词不当域名', () => {
    expect(kindOf('love')).toBe('unknown')
    expect(kindOf('love.jx')).toBe('unknown')
  })
})

describe('resolveSearchInput — 地址（HEX 40 位）', () => {
  const ADDR = '0x3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20c'

  it('带 0x 前缀的 40 位 hex → address，保持原有大小写', () => {
    expect(resolveSearchInput(ADDR)).toEqual<SearchResolution>({ kind: 'address', value: ADDR })
  })

  it('无 0x 前缀的 40 位 hex → 补前缀（v1 行为：goToAddrInfos("0x"+s)）', () => {
    expect(valueOf('3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20c')).toBe(ADDR)
  })

  it('🔴 40 位纯数字地址不被当成区块号（v2 原顺序 bug）', () => {
    // 这不是构造的边角案例：40 位全数字是合法 hex 地址，v1 也走地址分支。
    // v2 改动前 `if (/^\d+$/) → /block/` 排在地址判断之前，会跳去「区块 1234…」
    const digitsOnly = '1234567890123456789012345678901234567890'
    expect(kindOf(digitsOnly)).toBe('address')
    expect(valueOf(digitsOnly)).toBe(`0x${digitsOnly}`)
  })

  it('39 位 / 41 位 hex 不当地址（长度必须精确 40）', () => {
    expect(kindOf('3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20')).toBe('unknown')
    expect(kindOf('3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20cc')).toBe('unknown')
  })

  it('含非 hex 字符的 40 位串不当地址', () => {
    expect(kindOf('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe('unknown')
  })
})

describe('resolveSearchInput — 地址（JVA / B32）', () => {
  const HEX = '0x3d86dd50c2f333d3d79da2de6bcd5706add7a20c'

  it('B32 40 字符 j3 开头 → 解码成 hex 地址', () => {
    const r = resolveSearchInput('j38krd65xz7vea84ua5t0xhn2hq6ka0gsv2er7ar')
    expect(r.kind).toBe('address')
    expect(r.value.toLowerCase()).toBe(HEX)
  })

  it('full 22 字符中文 JVA → 解码成 hex 地址', () => {
    const r = resolveSearchInput('j3听值环摆备酚室埔孟室益它叔绘际er7ar')
    expect(r.kind).toBe('address')
    expect(r.value.toLowerCase()).toBe(HEX)
  })

  it('j3 开头但校验和不符 → unknown + invalid-jva（不静默跳转）', () => {
    // 末位改成 x 破坏校验和
    const bad = 'j38krd65xz7vea84ua5t0xhn2hq6ka0gsv2er7ax'
    expect(resolveSearchInput(bad)).toEqual<SearchResolution>({
      kind: 'unknown',
      value: bad,
      reason: 'invalid-jva',
    })
  })

  it('j3 开头但长度不对 → unknown + invalid-jva', () => {
    expect(resolveSearchInput('j3short').reason).toBe('invalid-jva')
  })
})

describe('resolveSearchInput — 交易哈希', () => {
  // 形状合法的 64 位 hex 即可（本节只验解析，不碰链）
  const TX = '0xe3978e8252c6a993de45bb0c3dc5321be4370be22043e299773df464ed67a830'

  it('带 0x 的 64 位 hex → tx', () => {
    expect(resolveSearchInput(TX)).toEqual<SearchResolution>({ kind: 'tx', value: TX })
  })

  it('无 0x 的 64 位 hex → tx 并补前缀（v1：goToTxInfos("0x"+s)）', () => {
    expect(valueOf(TX.slice(2))).toBe(TX)
  })

  it('🔴 64 位**区块哈希**也解析成 tx —— 这不是 bug 而是刻意保持 v1 的实际行为', () => {
    // v1 的区块哈希分支永不可达（`/[0-9a-zA-Z]{64}?/` 对区块哈希同样为真，
    // 必然先命中 tx 分支），所以 v1 从未支持按区块哈希搜索。
    // 真正的区块哈希长得和交易哈希一模一样（都是 64 hex），纯靠字符串无法区分。
    // 这里断言「当 tx 处理」是为了让将来的人知道：想支持区块哈希必须先去链上探测，
    // 不是加一行 `else if` 就能完成的 —— 那条路 v1 走过，是死代码。
    const blockHash = '0x' + 'ab'.repeat(32)
    expect(resolveSearchInput(blockHash).kind).toBe('tx')
  })
})

describe('resolveSearchInput — 区块高度', () => {
  it('十进制数字 → block', () => {
    expect(resolveSearchInput('1011228')).toEqual<SearchResolution>({
      kind: 'block',
      value: '1011228',
    })
  })

  it('前导零被去掉（v1 parseInt 也会去掉）', () => {
    expect(valueOf('000123')).toBe('123')
  })

  it('全零保留为 0（创世块存在；v1 的 parseInt>0 把它排除了）', () => {
    expect(valueOf('0')).toBe('0')
    expect(valueOf('000')).toBe('0')
  })

  it('🔴 数字后面跟字母不猜成区块号（v1 parseInt("12abc")=12 会静默跳错）', () => {
    expect(kindOf('12abc')).toBe('unknown')
  })

  it('负数不当区块号', () => {
    expect(kindOf('-5')).toBe('unknown')
  })

  it('小数不当区块号', () => {
    expect(kindOf('1.5')).toBe('unknown')
  })
})

describe('resolveSearchInput — 无法识别', () => {
  it('空输入 → unknown + empty', () => {
    expect(resolveSearchInput('')).toEqual<SearchResolution>({
      kind: 'unknown',
      value: '',
      reason: 'empty',
    })
  })

  it('纯空白 → unknown + empty', () => {
    expect(resolveSearchInput('   ').reason).toBe('empty')
  })

  it('普通词 → unknown + unrecognized', () => {
    expect(resolveSearchInput('hello world')).toEqual<SearchResolution>({
      kind: 'unknown',
      value: 'helloworld',
      reason: 'unrecognized',
    })
  })

  it('🔴 无法识别时**不得**返回 block（v2 原行为是 router.push(`/block/${q}`)）', () => {
    for (const bad of ['hello', '中文字符', '0x', '0xzz', '!!']) {
      expect(kindOf(bad)).not.toBe('block')
    }
  })
})

describe('resolveSearchInput — 畸形输入不产生「凭空地址」', () => {
  it('🔴 只剥**前导** 0x：尾部再带 0x 时不得拼出一个合法地址（v1 split/join 会）', () => {
    // v1 的实现是 requestStr.split('0x').join('')，会把**所有**出现的 0x 都剥掉。
    // 对一个真实地址再套一层 0x 前缀/后缀，v1 会「修复」成合法地址并跳转，
    // 用户输入的东西根本不是一个地址，却被静默解析成功。
    const addr = '3D86Dd50C2f333d3d79Da2DE6bCd5706adD7a20c' // 40 位 hex
    // v1: ('0x' + addr + '0x').split('0x').join('') === addr → 静默当成地址
    const trailing = `0x${addr}0x`
    expect(resolveSearchInput(trailing).kind).toBe('unknown')
    // 同理双前缀
    expect(resolveSearchInput(`0x0x${addr}`).kind).toBe('unknown')
    // 而正常带单个前导前缀仍然要成功，否则这条用例就变成「一律拒绝」的假守护
    expect(resolveSearchInput(`0x${addr}`).kind).toBe('address')
  })
})

describe('SEARCH_HELP_EXAMPLES', () => {
  it('恰好 5 类示例（与 v1 帮助弹层同类数）', () => {
    expect(SEARCH_HELP_EXAMPLES).toHaveLength(5)
  })

  it('🔴 每个示例都必须能被自己解析成功，且不是 unknown', () => {
    // 这条是这份帮助的唯一实际价值：示例点不出来就是用不了。
    // 反过来，把任意一条示例改错（比如区块号写成 12abc），这条立刻变红。
    for (const { label, example } of SEARCH_HELP_EXAMPLES) {
      const r = resolveSearchInput(example)
      expect(r.kind, `示例「${label}」= ${example} 应可解析`).not.toBe('unknown')
    }
  })

  it('示例覆盖 4 种跳转类型（区块/交易/地址/JNS）', () => {
    const kinds = new Set(SEARCH_HELP_EXAMPLES.map(e => resolveSearchInput(e.example).kind))
    expect(kinds).toEqual(new Set(['block', 'tx', 'address', 'jns']))
  })
})
