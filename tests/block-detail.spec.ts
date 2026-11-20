import { describe, it, expect } from 'vitest'
import {
  decodeHexToText,
  confirmationCount,
  hasInputData,
  chunkHex,
} from '../src/utils/block-detail'

describe('区块详情 · 确认数', () => {
  it('最新高度大于区块高度时取差值（v1 conf = number - blockNumber）', () => {
    expect(confirmationCount(1000n, 990n)).toBe(10)
    expect(confirmationCount(1000, 999)).toBe(1)
  })

  it('区块即最新块时为 0，不出现负数', () => {
    expect(confirmationCount(1000n, 1000n)).toBe(0)
    expect(confirmationCount(990n, 1000n)).toBe(0)
  })

  it('最新高度未就绪（null / undefined）时为 0，与 v1 初值一致', () => {
    expect(confirmationCount(null, 100n)).toBe(0)
    expect(confirmationCount(undefined, 100n)).toBe(0)
  })

  it('区块高度缺失时为 0', () => {
    expect(confirmationCount(1000n, null)).toBe(0)
    expect(confirmationCount(1000n, undefined)).toBe(0)
  })

  it('超大字面量保持整数不溢出成小数', () => {
    expect(confirmationCount(9_007_199_254_740_993n, 9_007_199_254_740_000n)).toBe(993)
  })
})

describe('区块详情 · extraData 解码', () => {
  it('0x 前缀与裸 hex 结果一致（v1 收裸 hex，viem 带前缀）', () => {
    const withPrefix = decodeHexToText('0x68656c6c6f')
    const bare = decodeHexToText('68656c6c6f')
    expect(withPrefix).toEqual(bare)
    expect(withPrefix.text).toBe('hello')
  })

  it('大写 hex 也能解（不依赖调用方大小写）', () => {
    // 0x48 = 'H'，0x65 = 'e'... 解码结果保留原始字符大小写
    expect(decodeHexToText('0x48656C6C6F').text).toBe('Hello')
  })

  it('clique 风格 extraData 的可读段完整解出', () => {
    // 32 字节 vanity 后接签名者列表与 65 字节 seal，前 32 字节填 0 时不可读
    const vanity = '00'.repeat(32)
    const r = decodeHexToText(`0x${vanity}`)
    expect(r.text).toBeNull()
    expect(r.nonPrintable).toBe(32)
    expect(r.bytes).toBe(32)
  })

  it('含 0 字节的串判为不可读，不返回乱码', () => {
    // 0x41='A' 0x00=NUL(不可打印) 0x42='B' → 只有 1 个不可打印字节
    const r = decodeHexToText('0x410042')
    expect(r.text).toBeNull()
    expect(r.nonPrintable).toBe(1)
    expect(r.bytes).toBe(3)
  })

  it('空串 / 0x / null 一律视为无内容', () => {
    expect(decodeHexToText('0x')).toEqual({ text: null, nonPrintable: 0, bytes: 0 })
    expect(decodeHexToText('')).toEqual({ text: null, nonPrintable: 0, bytes: 0 })
    expect(decodeHexToText(null)).toEqual({ text: null, nonPrintable: 0, bytes: 0 })
    expect(decodeHexToText(undefined)).toEqual({ text: null, nonPrintable: 0, bytes: 0 })
  })

  it('非法 hex（奇数长度 / 非 hex 字符）不抛异常，返回空', () => {
    expect(decodeHexToText('0x68656c6c6').text).toBeNull()
    expect(decodeHexToText('0xzz')).toEqual({ text: null, nonPrintable: 0, bytes: 0 })
  })

  it('制表与换行算可读，其它控制字符不算', () => {
    expect(decodeHexToText('0x410a42').text).toBe('A\nB')
    expect(decodeHexToText('0x410142').text).toBeNull() // 0x01 = SOH
  })

  it('中文 UTF-8 字节不被误判为可读 ASCII（宁可显示 raw hex）', () => {
    // “中” = e4b8ad，三个字节均 > 0x7e
    const r = decodeHexToText('0xe4b8ad')
    expect(r.text).toBeNull()
    expect(r.nonPrintable).toBe(3)
    expect(r.bytes).toBe(3)
  })
})

describe('区块详情 · 输入数据判据', () => {
  it('纯转账的 0x 不展示（对齐 v1 ng-if）', () => {
    expect(hasInputData('0x')).toBe(false)
    expect(hasInputData('')).toBe(false)
    expect(hasInputData(null)).toBe(false)
    expect(hasInputData(undefined)).toBe(false)
  })

  it('有 calldata 时展示', () => {
    expect(hasInputData('0xa9059cbb')).toBe(true)
    expect(hasInputData('a9059cbb')).toBe(true)
  })

  it('只有 0 字节也算有内容（不按数值判真假）', () => {
    expect(hasInputData('0x00')).toBe(true)
  })
})

describe('区块详情 · hex 折行', () => {
  it('按宽度切分且不丢字符', () => {
    const hex = 'ab'.repeat(100)
    const parts = chunkHex(hex, 64)
    expect(parts.every((p) => p.length <= 64)).toBe(true)
    expect(parts.join('')).toBe(hex)
  })

  it('空串返回空数组', () => {
    expect(chunkHex('')).toEqual([])
  })
})
