import { describe, expect, it } from 'vitest'
import { decodeRevertReason } from '../src/utils/revert'

/** 按 ABI 规范手工构造 Error(string) revert data（不借助 viem 的 encode，避免「用被测库验证被测库」）。 */
function buildErrorString(message: string): string {
  const hex = Buffer.from(message, 'utf8').toString('hex')
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')
  const offsetWord = '20'.padStart(64, '0')
  const lengthWord = (hex.length / 2).toString(16).padStart(64, '0')
  return `0x08c379a0${offsetWord}${lengthWord}${padded}`
}

/** 按 ABI 规范手工构造 Panic(uint256) revert data。 */
function buildPanic(code: number): string {
  return `0x4e487b71${code.toString(16).padStart(64, '0')}`
}

describe('decodeRevertReason — Error(string)', () => {
  // 回归用例：修复前这些全部返回空串（偏移量多算一格，长度字读成 4.7e76）。
  // 这是线上真实 bug：合约交互工具里交易失败时「错误信息是：」后面永远是空白。
  it.each([
    ['hello', 'ASCII 短消息'],
    ['insufficient balance', '含空格'],
    ['Not allowed to transfer gas energy', '真实链错误文案'],
    ['a'.repeat(100), '超过 32 字节需多字填充'],
    ['中文错误信息', 'UTF-8 多字节'],
  ])('能解出 %j（%s）', message => {
    expect(decodeRevertReason(buildErrorString(message))).toBe(message)
  })

  it('等等长 32 字节边界消息不丢字符', () => {
    const exact32 = 'x'.repeat(32)
    expect(decodeRevertReason(buildErrorString(exact32))).toBe(exact32)
    const exact33 = 'y'.repeat(33)
    expect(decodeRevertReason(buildErrorString(exact33))).toBe(exact33)
  })

  it('空字符串消息解出空串而不是崩溃', () => {
    expect(decodeRevertReason(buildErrorString(''))).toBe('')
  })
})

describe('decodeRevertReason — Panic(uint256)', () => {
  it.each([
    [1, 'assert 失败'],
    [17, '算术溢出'],
    [18, '除以零'],
    [50, '数组越界'],
  ])('Panic(%i) 映射为「%s」', (code, expected) => {
    expect(decodeRevertReason(buildPanic(code))).toBe(`Panic(${code}): ${expected}`)
  })

  it('未知 Panic 码不臆造含义', () => {
    expect(decodeRevertReason(buildPanic(999))).toBe('Panic(999): 未知错误')
  })
})

describe('decodeRevertReason — 兜底与健壮性', () => {
  it('未知 selector 返回可识别摘要，不返回空串', () => {
    const result = decodeRevertReason('0xdeadbeef' + '0'.repeat(64))
    expect(result).toBe('revert data: 0xdeadbeef00000000...')
  })

  it('畸形数据不抛异常（返回空串表示放弃解析）', () => {
    expect(() => decodeRevertReason('0x08c379a0')).not.toThrow()
    expect(decodeRevertReason('0x08c379a0')).toBe('')
    expect(() => decodeRevertReason('0x')).not.toThrow()
  })
})
