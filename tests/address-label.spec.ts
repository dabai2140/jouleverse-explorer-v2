import { describe, expect, it, beforeEach } from 'vitest'
import { lookupAddressLabel, addressLabelName, __resetAddressLabelIndex } from '../src/utils/address-label'
import { toolboxContracts } from '../src/contracts/toolbox'

beforeEach(() => { __resetAddressLabelIndex() })

describe('lookupAddressLabel — 已知合约', () => {
  it('能查到 toolbox 里注册的每个合约（逐条断言，不是抽查一个）', () => {
    for (const c of toolboxContracts) {
      const label = lookupAddressLabel(c.address)
      expect(label, `应能查到 ${c.key} (${c.address})`).not.toBeNull()
      expect(label!.name).toBe(c.name)
      expect(label!.key).toBe(c.key)
    }
  })

  it('JVCore 核心身份能被识别（交易详情里最常见的对手方）', () => {
    const label = lookupAddressLabel('0x8d214415b9c5F5E4Cf4CbCfb4a5DEd47fb516392')
    expect(label).toEqual({
      name: 'JVCore 核心身份',
      tag: 'Core ID 身份标识 NFT',
      key: 'jvcore',
    })
  })

  it('大小写不敏感（EIP-55 校验和地址与全小写等价）', () => {
    const checksummed = '0x8d214415b9c5F5E4Cf4CbCfb4a5DEd47fb516392'
    const lower = checksummed.toLowerCase()
    const upper = checksummed.toUpperCase().replace('0X', '0x')
    expect(lookupAddressLabel(lower)?.name).toBe(lookupAddressLabel(checksummed)?.name)
    expect(lookupAddressLabel(upper)?.name).toBe(lookupAddressLabel(checksummed)?.name)
  })

  it('周围空白不影响匹配', () => {
    expect(lookupAddressLabel('  0x8d214415b9c5F5E4Cf4CbCfb4a5DEd47fb516392  ')?.key).toBe('jvcore')
  })
})

describe('lookupAddressLabel — 未注册地址', () => {
  it('普通 EOA 返回 null（不返回地址本身，调用方据此决定是否渲染标签）', () => {
    expect(lookupAddressLabel('0xb23823…0f4d1489'.replace('…', '0000000000000000000000000000'))).toBeNull()
  })

  it('空值 / 空串 / undefined 全部返回 null 而不是抛错', () => {
    expect(lookupAddressLabel(null)).toBeNull()
    expect(lookupAddressLabel(undefined)).toBeNull()
    expect(lookupAddressLabel('')).toBeNull()
    expect(lookupAddressLabel('   ')).toBeNull()
  })

  it('非地址字符串返回 null（不误命中）', () => {
    expect(lookupAddressLabel('hello')).toBeNull()
    expect(lookupAddressLabel('0x')).toBeNull()
  })
})

describe('addressLabelName', () => {
  it('命中返回名称', () => {
    expect(addressLabelName('0x7fba9BB966189Db8C4fE33B7bf67Bfa24203c6AD')).toBe('WJ 包装 J')
  })

  it('未命中返回 null（不是空串，便于 `??` 兜底）', () => {
    expect(addressLabelName('0x0000000000000000000000000000000000000000')).toBeNull()
  })
})

describe('惰性索引的正确性', () => {
  it('重置后重建仍返回同样结果（索引不是一次性快照）', () => {
    const before = lookupAddressLabel('0x9c100856f5C60a3ec87Aa408567304DB2AfC241F')
    __resetAddressLabelIndex()
    const after = lookupAddressLabel('0x9c100856f5C60a3ec87Aa408567304DB2AfC241F')
    expect(after).toEqual(before)
    expect(after?.name).toBe('星球')
  })

  it('同一地址重复注册时保留第一个（注册表顺序即优先级）', () => {
    // toolbox 里地址唯一，此用例锁住「未来若出现重复登记，行为是确定性的」
    const seen = new Map<string, string>()
    let dupCount = 0
    for (const c of toolboxContracts) {
      const key = c.address.toLowerCase()
      if (seen.has(key)) {
        dupCount++
        expect(lookupAddressLabel(c.address)?.key).toBe(seen.get(key))
      } else {
        seen.set(key, c.key)
      }
    }
    // 当前注册表无重复地址；有重复时上面的断言已验证「取第一个」
    expect(dupCount).toBe(0)
  })
})
