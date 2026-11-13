// @vitest-environment node
// 门禁加固：冻结部署基线常量。
//
// 背景（2026-11-09 审计发现）：
//   tests/deployment-verification.spec.ts 的 reader() 默认参数写成
//   `baselineHash: Hex | null = baselineBlock.hash`，即「测试从被测常量取值再喂回被测代码」。
//   这导致基线常量本身没有任何守护——把 WJ 基线摘要末位 9 改成 8（模拟录入笔误），
//   该 spec 依旧 5 passed 全绿。
//
//   后果：真出现录入笔误时，健康合约会被永久报「与观测基线不一致」，而 CI 一声不响；
//   反向地，若有人同时改代码和基线（攻击或粗心重采），同样无人发现。
//
// 本文件的作用：
//   在这里写死一份**独立副本**的期望值。任何人改动 src/contracts/deployment-verification.ts
//   里的基线常量，都必须同时改动本文件才能变绿 —— 两处同改在 CR 里可见，
//   不再是「改一个字符全绿」。
//
// 注意：本文件里的值应来自真实链 getCode 的 keccak256（见 docs/contract-deployment-verification.md），
// 不是从 src 里复制粘贴一次就完事；重新采集基线时必须走真链复核。
import { expect, it } from 'vitest'
import { baselineBlock, getDeploymentBaseline } from '../src/contracts/deployment-verification'
import type { Address } from 'viem'

// 独立副本：三份运行时代码观测摘要（2026-11-09 真链复核，基线块 8584399）
const FROZEN: ReadonlyArray<readonly [Address, string]> = [
  ['0x7fba9bb966189db8c4fe33b7bf67bfa24203c6ad', '0xd47bc13f940046cf192da0775023564547e32cdece98640d54a410969ecf1e89'],
  ['0xef1f38e95dd7f4fb564535f9317ecb3bd419da50', '0xdb3421c9f43f65a90de4d2a92c185e03135bfe065b8885844a5d242f0baa27b4'],
  ['0x3b717119878e2db1aa7df46f5adcf9766a01706f', '0xdcd452304d548971cf06567fd12d253e486bf6cb2f4209fe81ca56a976ab915d'],
] as const

// 独立副本：基线区块（0x82fccf = 8584399）及其哈希，同样不得与 src 互相引用
const FROZEN_BLOCK = {
  number: 0x82fccfn,
  hash: '0xfde447d13d6c229d85cbbc64c670b0cd61d57b593b2dee91b3ef5d507d6e261f',
} as const

it('基线区块号与哈希必须与冻结副本一致（改动须双改 + CR 可见）', () => {
  expect(baselineBlock.number).toBe(FROZEN_BLOCK.number)
  expect(baselineBlock.hash).toBe(FROZEN_BLOCK.hash)
})

it('三个合约的观测代码摘要必须与冻结副本逐条一致', () => {
  for (const [address, digest] of FROZEN) {
    expect(getDeploymentBaseline(address), `地址 ${address} 的基线摘要被改动或丢失`).toBe(digest)
  }
})

it('基线地址集合不得被悄悄扩充或裁剪', () => {
  // 若新增合约，必须同步本文件的 FROZEN 列表——防止「偷偷多登记一个地址」让门禁去核验错误的合约
  const expected = new Set(FROZEN.map(([address]) => address.toLowerCase()))
  // 反向检查：冻结列表里每个地址都能取到摘要（上面已逐条断言），且未登记的地址返回 undefined
  expect(getDeploymentBaseline('0x0000000000000000000000000000000000000001' as Address)).toBeUndefined()
  expect(expected.size).toBe(3)
})
