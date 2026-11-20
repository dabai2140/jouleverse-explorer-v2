/**
 * 地址标签（v1 `getAddressTag()` 对等）
 *
 * v1 `app/scripts/misc/deployments.js:406` 用部署清单把已知合约地址翻成中文 tag，
 * 交易/区块详情页的「从 / 至」显示成可读名字而不是裸地址。
 *
 * v2 的权威地址来源是 `src/contracts/toolbox.ts`（12 个已注册合约），
 * 这里只做「地址 → 名称」纯映射，不引 RPC、不引 DOM，便于单测。
 *
 * ⚠️ 与 v1 的差异（有意）：v1 的 tag 是「JNS合约」「红包」这类短名，
 * v2 用 toolbox 里的 `name`（「JNS 域名」「链上红包」）——同一份注册表已经在合约工具页
 * 作为标题展示，两处用同一字符串才不会出现「同一个合约两个名字」。
 */
import { toolboxContracts } from '../contracts/toolbox'

export interface AddressLabel {
  /** 可读名称，如「JVCore 核心身份」 */
  name: string
  /** 合约用途短说明，如「Core ID 身份标识 NFT」 */
  tag: string
  /** toolbox 的 key，可用于跳 `/tools/contract/:key` */
  key: string
}

/** 规范化地址：小写 + 去空白，非法输入返回 null（不做正则校验，调用方自行保证来源可信） */
function normalize(address: string | null | undefined): string | null {
  if (!address) return null
  const trimmed = address.trim().toLowerCase()
  return trimmed.length === 0 ? null : trimmed
}

/** 惰性构建地址索引：每次 import 都建表没必要，首次查询时建一次即可 */
let index: Map<string, AddressLabel> | null = null

function buildIndex(): Map<string, AddressLabel> {
  const map = new Map<string, AddressLabel>()
  for (const c of toolboxContracts) {
    const key = normalize(c.address)
    if (!key) continue
    // 同一地址重复注册时保留第一个（注册表顺序即优先级，与合约工具页一致）
    if (!map.has(key)) {
      map.set(key, { name: c.name, tag: c.tag, key: c.key })
    }
  }
  return map
}

/** 查地址对应的合约标签；未注册返回 null（不要返回地址本身，调用方据此决定是否展示标签） */
export function lookupAddressLabel(address: string | null | undefined): AddressLabel | null {
  const key = normalize(address)
  if (!key) return null
  if (!index) index = buildIndex()
  return index.get(key) ?? null
}

/** 便捷方法：有标签返回名称，没有返回 null（视图里直接 `?? ''` 或条件渲染） */
export function addressLabelName(address: string | null | undefined): string | null {
  return lookupAddressLabel(address)?.name ?? null
}

/** 供测试重置惰性索引（生产代码不需要调用） */
export function __resetAddressLabelIndex(): void {
  index = null
}
