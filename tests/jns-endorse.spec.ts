import { describe, expect, it } from 'vitest'
import {
  ENDORSE_PRESETS,
  MAX_ENDORSE_WJ,
  parseEndorseAmount,
  normalizeJnsId,
  jnsNameOf,
  validateMintName,
  canMintJns,
} from '../src/utils/jns-endorse'

/**
 * 打赏金额边界 —— 严格对齐 v1 `endorseJNSConfirmDialog`：
 * `Number.isNaN(x) || x <= 0 || x > 100` 才拦 ⇒ **0 < x ≤ 100**。
 * 这里重点锁住三件容易错的事：
 *   1) 100 是允许的（v1 文案写「小于100」，代码却放行 100，以代码为准）
 *   2) 100.000000000000000001 必须被拦（Number 会四舍五入成 100 放过去）
 *   3) 金额全程走 bigint / 字符串，不经浮点
 */
describe('parseEndorseAmount — 打赏金额边界（0 < x ≤ 100 WJ）', () => {
  it('快选四档 1/2/5/10 全部通过，转成正确 wei', () => {
    expect(parseEndorseAmount(1)).toEqual({ ok: true, wei: 10n ** 18n, wj: '1' })
    expect(parseEndorseAmount(2)).toEqual({ ok: true, wei: 2n * 10n ** 18n, wj: '2' })
    expect(parseEndorseAmount(5)).toEqual({ ok: true, wei: 5n * 10n ** 18n, wj: '5' })
    expect(parseEndorseAmount(10)).toEqual({ ok: true, wei: 10n * 10n ** 18n, wj: '10' })
  })

  it('快选档位常量就是 v1 的那四档（改档位必须同时改这里）', () => {
    expect([...ENDORSE_PRESETS]).toEqual([1, 2, 5, 10])
    expect(MAX_ENDORSE_WJ).toBe(100)
  })

  it('上限 100 允许（v1 代码 `> 100` 才拦，弹窗文案「小于100」是文案错）', () => {
    const r = parseEndorseAmount(100)
    expect(r.ok).toBe(true)
    expect(r.ok && r.wei).toBe(100n * 10n ** 18n)
  })

  it('100.000000000000000001 必须拦（Number 路径会四舍五入成 100 而放过去）', () => {
    const r = parseEndorseAmount('100.000000000000000001')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('不超过 100')
  })

  it('100.1 / 101 / 1000 全部超限', () => {
    for (const v of ['100.1', '101', '1000']) {
      const r = parseEndorseAmount(v)
      expect(r.ok).toBe(false)
    }
  })

  it('0 与 0.0 与 0.000 都是「不大于 0」', () => {
    for (const v of ['0', '0.0', '0.000']) {
      const r = parseEndorseAmount(v)
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.error).toContain('大于 0')
    }
  })

  it('小数允许（v1 明写 float number allowed）：0.1 WJ 精确到 17 位 wei', () => {
    const r = parseEndorseAmount('0.1')
    expect(r.ok).toBe(true)
    // 0.1 J = 1e17 wei（字符串切位得到，不经浮点）
    expect(r.ok && r.wei).toBe(10n ** 17n)
    expect(r.ok && r.wj).toBe('0.1')
  })

  it('极小值 0.000000000000000001（1 wei）能过', () => {
    const r = parseEndorseAmount('0.000000000000000001')
    expect(r.ok).toBe(true)
    expect(r.ok && r.wei).toBe(1n)
  })

  it('19 位小数拒绝（超过 wei 精度，无法精确上链）', () => {
    const r = parseEndorseAmount('0.0000000000000000001')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('18 位小数')
  })

  it('尾零归一：1.500 → wj "1.5"；2.000 → wj "2"', () => {
    const a = parseEndorseAmount('1.500')
    const b = parseEndorseAmount('2.000')
    expect(a.ok && a.wj).toBe('1.5')
    expect(b.ok && b.wj).toBe('2')
    // 但 wei 仍相等，说明归一只是显示层
    expect(a.ok && a.wei).toBe(parseEndorseAmount('1.5').ok && (parseEndorseAmount('1.5') as any).wei)
  })

  it('前导零归一：007 → wj "7"、wei 7e18', () => {
    const r = parseEndorseAmount('007')
    expect(r.ok && r.wj).toBe('7')
    expect(r.ok && r.wei).toBe(7n * 10n ** 18n)
  })

  it('拒绝格式垃圾：空、负号、正号、科学计数法、千分位、内嵌空格', () => {
    for (const v of ['', ' ', '-1', '+1', '1e2', '1,000', '1 5', '.5', '5.']) {
      expect(parseEndorseAmount(v).ok, `应拒绝 ${JSON.stringify(v)}`).toBe(false)
    }
  })

  it('null / undefined 报「请填写」，不是 0', () => {
    for (const v of [null, undefined]) {
      const r = parseEndorseAmount(v as any)
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.error).toContain('请填写')
    }
  })
})

describe('normalizeJnsId — DID 页域名规范化（含 v1 两个大小写特例）', () => {
  it('普通域名转小写', () => {
    expect(normalizeJnsId('Alice.j')).toBe('alice.j')
    expect(normalizeJnsId('  alice.J  ')).toBe('alice.j')
  })

  it('gm.j → GM.j（链上真实大小写，v1 硬编码还原）', () => {
    expect(normalizeJnsId('gm.j')).toBe('GM.j')
    expect(normalizeJnsId('GM.J')).toBe('GM.j')
  })

  it('nana.j → Nana.j', () => {
    expect(normalizeJnsId('nana.j')).toBe('Nana.j')
    expect(normalizeJnsId('NANA.j')).toBe('Nana.j')
  })

  it('缺 .j 后缀返回 null', () => {
    expect(normalizeJnsId('alice')).toBeNull()
    expect(normalizeJnsId('alice.jx')).toBeNull()
  })

  it('裸 ".j" 返回 null（空名字）', () => {
    expect(normalizeJnsId('.j')).toBeNull()
  })

  it('非法字符返回 null（下划线、空格、中文、点号）', () => {
    for (const v of ['a_b.j', 'a b.j', '中文.j', 'a.b.j']) {
      expect(normalizeJnsId(v), `应拒绝 ${v}`).toBeNull()
    }
  })

  it('null / undefined / 空串返回 null', () => {
    expect(normalizeJnsId(null)).toBeNull()
    expect(normalizeJnsId(undefined)).toBeNull()
    expect(normalizeJnsId('')).toBeNull()
  })

  it('jnsNameOf 去掉 .j 且保留特例大小写', () => {
    expect(jnsNameOf('GM.j')).toBe('GM')
    expect(jnsNameOf('alice.j')).toBe('alice')
    expect(jnsNameOf('alice')).toBe('alice')
  })
})

describe('validateMintName — owner-only mint 的名称校验（对齐 v1 mintJNS）', () => {
  it('正常名字通过，返回去掉 .j 的名字', () => {
    expect(validateMintName('alice.j')).toEqual({ ok: true, name: 'alice' })
  })

  it('保留大小写（mint 时名字大小写有意义，不做小写化）', () => {
    expect(validateMintName('Alice.j')).toEqual({ ok: true, name: 'Alice' })
  })

  it('不以 .j 结尾 → 报「必须以 .j 结尾」', () => {
    const r = validateMintName('alice')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('必须以 .j 结尾')
  })

  it('裸 .j 也报必须带名字（length<=2 判断，v1 的 search 正则同样拦掉）', () => {
    expect(validateMintName('.j').ok).toBe(false)
  })

  it('非法字符 → 报字符集错误', () => {
    const r = validateMintName('a_b.j')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('只可以包含')
  })

  it('中横线与数字允许', () => {
    expect(validateMintName('a-b-1.j')).toEqual({ ok: true, name: 'a-b-1' })
  })
})

describe('canMintJns — owner-only 入口可见性（对齐 v1 模板条件）', () => {
  const owner = '0xAbC0000000000000000000000000000000000001'
  const base = { contractOwner: owner, chainId: 3666, exists: false }

  it('本链 + 本人是 owner + 域名不存在 → 显示', () => {
    expect(canMintJns({ ...base, connectedAccount: owner })).toBe(true)
  })

  it('地址大小写不同仍显示（v1 模板里两边都 toLowerCase）', () => {
    expect(canMintJns({ ...base, connectedAccount: owner.toLowerCase() })).toBe(true)
    expect(canMintJns({ ...base, connectedAccount: owner.toUpperCase().replace('0X', '0x') })).toBe(true)
  })

  it('域名已存在 → 不显示（没有可 mint 的东西）', () => {
    expect(canMintJns({ ...base, connectedAccount: owner, exists: true })).toBe(false)
  })

  it('不是 owner → 不显示（v1 就是 owner-only，不放开公开注册）', () => {
    expect(canMintJns({ ...base, connectedAccount: '0x0000000000000000000000000000000000000002' })).toBe(false)
  })

  it('非 3666 链 → 不显示（v1 判 chainId == 0xe52）', () => {
    expect(canMintJns({ ...base, connectedAccount: owner, chainId: 1 })).toBe(false)
    expect(canMintJns({ ...base, connectedAccount: owner, chainId: null })).toBe(false)
  })

  it('未连钱包 / 未读到 owner → 不显示', () => {
    expect(canMintJns({ ...base, connectedAccount: null })).toBe(false)
    expect(canMintJns({ ...base, connectedAccount: '', contractOwner: owner })).toBe(false)
    expect(canMintJns({ ...base, connectedAccount: owner, contractOwner: null })).toBe(false)
  })

  it('非 0x 开头的字符串不当作地址比较（防止空串 / undefined 字面量误判相等）', () => {
    expect(canMintJns({ ...base, connectedAccount: 'undefined', contractOwner: 'undefined' })).toBe(false)
  })
})
