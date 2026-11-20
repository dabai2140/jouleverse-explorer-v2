import { describe, expect, it } from 'vitest'
import { toDualUnit, computeTxFee } from '../src/utils/amount-dual'

describe('toDualUnit — J 与 Gwei 双单位换算', () => {
  it('1 J = 1e18 wei → j="1"，gwei="1000000000"', () => {
    const r = toDualUnit(10n ** 18n)
    expect(r).toEqual({ j: '1', gwei: '1000000000' })
  })

  it('1 Gwei = 1e9 wei → j="0.000000001"，gwei="1"', () => {
    const r = toDualUnit(10n ** 9n)
    expect(r).toEqual({ j: '0.000000001', gwei: '1' })
  })

  it('真实链 gasPrice 2.5 Gwei（2500000000 wei）→ 两档都对', () => {
    const r = toDualUnit(2_500_000_000n)
    expect(r).toEqual({ j: '0.000000002', gwei: '2.5' })
  })

  it('0 wei → 两个 0（不是空串，不是 null）', () => {
    expect(toDualUnit(0n)).toEqual({ j: '0', gwei: '0' })
  })

  it('去尾零：1.500 → 1.5，2.000 → 2', () => {
    expect(toDualUnit(1_500_000_000n)?.gwei).toBe('1.5')
    expect(toDualUnit(3_000_000_000n)?.gwei).toBe('3')
  })

  it('null / undefined → null（视图据此显示「—」而不是 0）', () => {
    expect(toDualUnit(null)).toBeNull()
    expect(toDualUnit(undefined)).toBeNull()
  })

  it('负数返回 null（不可能出现的输入，但不应算出负值展示给用户）', () => {
    expect(toDualUnit(-1n)).toBeNull()
  })

  it('超大值不丢精度：1e30 wei 的 Gwei 档末位仍是 0', () => {
    // 1e30 wei = 1e12 J = 1e21 Gwei
    const r = toDualUnit(10n ** 30n)
    expect(r!.j).toBe('1000000000000')
    expect(r!.gwei).toBe('1000000000000000000000')
  })

  it('超过 2^53 的 wei 值不被 Number 精度截断（关键：这正是不能用 Number 的理由）', () => {
    // 9007199254740993 = 2^53 + 1，Number 无法精确表示
    const wei = 9007199254740993n
    const r = toDualUnit(wei)
    // 换算成 Gwei 后是 9007199.254740993，取 6 位小数 → 9007199.25474
    expect(r!.gwei).toBe('9007199.25474')
    // 若走 Number 再转字符串，末位会变成 ...992 或类似误差
    expect(String(Number(wei))).not.toBe(wei.toString())
  })

  it('J 档默认最多 9 位小数（1 Gwei 已经是 9 位，能完整显示）', () => {
    expect(toDualUnit(10n ** 9n)?.j).toBe('0.000000001')
  })

  it('Gwei 档默认最多 6 位小数（截断而非四舍五入）', () => {
    // 1.1234567 Gwei → 截断成 1.123456
    expect(toDualUnit(1_123_456_700n)?.gwei).toBe('1.123456')
  })

  it('可自定义小数位', () => {
    expect(toDualUnit(1_500_000_000n, { gweiMaxDecimals: 0 })?.gwei).toBe('1')
    // 1 Gwei = 1e-9 J，截到 3 位小数后是 0.000，去尾零即 "0"
    expect(toDualUnit(10n ** 9n, { jMaxDecimals: 3 })?.j).toBe('0')
    // 保留 12 位则能看到真实值
    expect(toDualUnit(10n ** 9n, { jMaxDecimals: 12 })?.j).toBe('0.000000001')
  })
})

describe('computeTxFee — gasUsed × gasPrice', () => {
  it('常规计算：244326 × 2.5 Gwei', () => {
    expect(computeTxFee(244326n, 2_500_000_000n)).toBe(610_815_000_000_000n)
  })

  it('gasUsed 为 0 → 手续费 0（不是 null）', () => {
    expect(computeTxFee(0n, 2_500_000_000n)).toBe(0n)
  })

  it('gasPrice 为 0 → 手续费 0（本链 PoA 可能出现）', () => {
    expect(computeTxFee(244326n, 0n)).toBe(0n)
  })

  it('任一入参缺失 → null（不能把「不知道」渲染成「免费」）', () => {
    expect(computeTxFee(null, 2_500_000_000n)).toBeNull()
    expect(computeTxFee(244326n, null)).toBeNull()
    expect(computeTxFee(undefined, undefined)).toBeNull()
  })

  it('负数视为非法 → null', () => {
    expect(computeTxFee(-1n, 1n)).toBeNull()
    expect(computeTxFee(1n, -1n)).toBeNull()
  })

  it('超大值不丢精度（bigint 相乘，与 Number 行为对照）', () => {
    const gasUsed = 30_000_000n
    const gasPrice = 10n ** 12n
    expect(computeTxFee(gasUsed, gasPrice)).toBe(30_000_000_000_000_000_000n)
  })

  // 回归用例：反向注入「改用 Number 相乘」曾全部绕绿——因为 3e19 恰好能被浮点精确表示。
  // 下面这对入参的乘积 2^53+1 是 Number 无法表示的，才算真正锁住 bigint 路径。
  it('乘积超过 2^53 且不能被浮点精确表示时不丢精度', () => {
    const gasUsed = 9007199254740993n // 2^53 + 1
    const gasPrice = 1n
    expect(computeTxFee(gasUsed, gasPrice)).toBe(9007199254740993n)
    // 先证明这对入参确实能让 Number 出错，否则本用例是假覆盖
    expect(BigInt(Number(gasUsed) * Number(gasPrice))).not.toBe(9007199254740993n)
  })

  it('两个大数相乘仍精确（Number 路径会直接偏移）', () => {
    const gasUsed = 9007199254740993n
    const gasPrice = 3n
    expect(computeTxFee(gasUsed, gasPrice)).toBe(27021597764222979n)
    expect(BigInt(Number(gasUsed) * Number(gasPrice))).not.toBe(27021597764222979n)
  })
})

describe('双单位与手续费的组合（视图实际用法）', () => {
  it('手续费换算成双单位后与 gasPrice 的量级自洽', () => {
    const gasUsed = 244326n
    const gasPrice = 2_500_000_000n
    const fee = computeTxFee(gasUsed, gasPrice)!
    const dual = toDualUnit(fee)!
    // 0.000611 J ≈ 610815 Gwei
    expect(dual.j).toBe('0.000610815')
    expect(dual.gwei).toBe('610815')
  })
})
