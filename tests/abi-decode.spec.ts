import { describe, expect, it, beforeEach } from 'vitest'
import { decodeInput, extractSelector, __resetDecodeIndex } from '../src/utils/abi-decode'

beforeEach(() => { __resetDecodeIndex() })

/**
 * 手工构造 calldata，不借助 viem 的 encodeFunctionData。
 * 理由同 tests/revert-decode.spec.ts：用被测库生成输入再验证被测库，等于自证。
 */
function word(hexNo0x: string): string {
  return hexNo0x.padStart(64, '0')
}

describe('extractSelector', () => {
  it('取前 4 字节（含 0x 共 10 字符）', () => {
    expect(extractSelector('0xa9059cbb' + word('0'.repeat(40)))).toBe('0xa9059cbb')
  })

  it('不足 4 字节返回 null（不是空串）', () => {
    expect(extractSelector('0x')).toBeNull()
    expect(extractSelector('0xa9')).toBeNull()
    expect(extractSelector('0xa9059c')).toBeNull()
  })

  it('空值 / 非 hex 返回 null', () => {
    expect(extractSelector(null)).toBeNull()
    expect(extractSelector(undefined)).toBeNull()
    expect(extractSelector('')).toBeNull()
    expect(extractSelector('a9059cbb00')).toBeNull()
    expect(extractSelector('hello world')).toBeNull()
  })

  it('大写 0X 前缀也能识别，且输出归一为小写', () => {
    expect(extractSelector('0XA9059CBB' + word('0'))).toBe('0xa9059cbb')
  })
})

describe('decodeInput — WJ transfer（真实链上最常见的 calldata）', () => {
  // transfer(address to, uint256 value)，选择器 0xa9059cbb
  const to = '1'.repeat(40)
  const value = (123456789n).toString(16)
  const calldata = `0xa9059cbb${word(to)}${word(value)}`

  it('能解出函数名与参数', () => {
    const r = decodeInput(calldata)
    expect(r).not.toBeNull()
    expect(r!.functionName).toBe('transfer')
    expect(r!.selector).toBe('0xa9059cbb')
    expect(r!.argTypes).toBe('address,uint256')
    expect(r!.signature).toBe('transfer(address,uint256)')
    expect(r!.args).toHaveLength(2)
    expect(r!.args[0].name).toBe('to')
    expect(r!.args[0].type).toBe('address')
    // 地址参数会被 viem 归一成 checksum 形式，比对时忽略大小写
    expect(r!.args[0].value.toLowerCase()).toBe(`0x${to}`.toLowerCase())
    expect(r!.args[1].name).toBe('value')
    expect(r!.args[1].type).toBe('uint256')
    expect(r!.args[1].value).toBe('123456789')
  })

  it('标明是按哪个合约的 ABI 解出的（不假装唯一确定）', () => {
    const r = decodeInput(calldata)
    expect(r!.contractName).toBe('WJ 包装 J')
    expect(r!.contractKey).toBe('wj')
  })
})

describe('decodeInput — 无参函数', () => {
  // WJ deposit() 的选择器是 0xd0e30db0（无参数，calldata 只有选择器）
  it('纯选择器（无参数）也能解，args 为空数组', () => {
    const r = decodeInput('0xd0e30db0')
    expect(r).not.toBeNull()
    expect(r!.functionName).toBe('deposit')
    expect(r!.args).toEqual([])
    expect(r!.argTypes).toBe('')
  })
})

describe('decodeInput — 解不出的情形（都必须返回 null，不能抛错）', () => {
  it('空输入 / 0x', () => {
    expect(decodeInput('')).toBeNull()
    expect(decodeInput('0x')).toBeNull()
    expect(decodeInput(null)).toBeNull()
    expect(decodeInput(undefined)).toBeNull()
  })

  it('未知选择器（不在已注册的 12 份 ABI 内）', () => {
    expect(decodeInput('0xdeadbeef' + word('0'))).toBeNull()
  })

  it('选择器命中但参数区长度不足 → 静默返回 null', () => {
    // transfer 只给选择器、不给参数
    expect(decodeInput('0xa9059cbb')).toBeNull()
    // 参数区被截断
    expect(decodeInput('0xa9059cbb' + word('1'.repeat(40)).slice(0, 32))).toBeNull()
  })

  it('长度不足 4 字节的输入返回 null', () => {
    expect(decodeInput('0xa9')).toBeNull()
  })
})

describe('decodeInput — 幂等与索引复用', () => {
  const calldata = `0xa9059cbb${word('2'.repeat(40))}${word('1')}`

  it('重复调用结果一致（索引缓存不影响结果）', () => {
    const a = decodeInput(calldata)
    const b = decodeInput(calldata)
    expect(b).toEqual(a)
  })

  it('重置索引后仍能解（不是一次性快照）', () => {
    const before = decodeInput(calldata)
    __resetDecodeIndex()
    const after = decodeInput(calldata)
    expect(after).toEqual(before)
  })

  it('解出的 signature 与 args 的 type 序列一致（防止两处独立拼装后走样）', () => {
    for (const sample of [
      `0xa9059cbb${word('3'.repeat(40))}${word('1')}`,
      '0xd0e30db0',
    ]) {
      const r = decodeInput(sample)
      if (!r) continue
      expect(`(${r.args.map(a => a.type).join(',')})`).toBe(`(${r.argTypes})`)
      expect(r.signature).toBe(`${r.functionName}(${r.argTypes})`)
    }
  })
})
