// OpenZeppelin StandardMerkleTree (v1.0.8) 兼容实现 —— 使用 viem 原语重写
//
// 算法与 @openzeppelin/merkle-tree@1.0.8 完全一致，保证与链上空投合约的
// MerkleProof 验证完全兼容：
//   - leafHash = keccak256(keccak256(abi.encode(types, value)))   （双重哈希）
//   - nodeHash = keccak256(concat([a, b].sort(compare)))           （按数值比较排序）
//   - sortLeaves = true（OZ 默认，链上 multiproof 验证推荐）
//
// 不引入 ethers/@openzeppelin 依赖，仅用 viem 的 keccak256 / concat /
// encodeAbiParameters，避免打包体积膨胀。

import { concat, encodeAbiParameters, keccak256, type Hex } from 'viem'

export type { Hex }

/** 按无符号数值比较两个哈希（与 OZ bytes.compare 语义一致） */
function compareHex(a: Hex, b: Hex): number {
  const diff = BigInt(a) - BigInt(b)
  return diff > 0n ? 1 : diff < 0n ? -1 : 0
}

/** 叶子哈希：keccak256(keccak256(abi.encode(types, value))) */
export function standardLeafHash(types: readonly string[], value: readonly unknown[]): Hex {
  const params = types.map((t) => ({ type: t }))
  return keccak256(keccak256(encodeAbiParameters(params as never, value as never)))
}

/** 节点哈希：keccak256(concat([a, b].sort(compare))) */
export function standardNodeHash(a: Hex, b: Hex): Hex {
  return keccak256(concat([a, b].sort(compareHex)))
}

export interface StandardMerkleTree {
  root: Hex
  leafCount: number
  /** 按原值索引取证明（与 OZ entries()/getProof(i) 语义一致） */
  getProof: (valueIndex: number) => Hex[]
}

/**
 * 构建 OZ StandardMerkleTree（sortLeaves = true）
 * @param values     叶子值数组，如 [[address, amount], ...]
 * @param valueTypes 值类型，如 ['address', 'uint256']
 */
export function buildStandardMerkleTree(
  values: readonly (readonly unknown[])[],
  valueTypes: readonly string[],
): StandardMerkleTree {
  if (values.length === 0) {
    throw new Error('叶子数量不能为 0')
  }

  // 1) 计算叶子哈希并按哈希排序（sortLeaves = true，与 OZ 默认一致）
  const sorted = values
    .map((value, valueIndex) => ({ valueIndex, hash: standardLeafHash(valueTypes, value) }))
    .sort((a, b) => compareHex(a.hash, b.hash))

  // 2) 堆式存储（2n-1 节点，叶子在尾部，自底向上计算内部节点）
  const n = sorted.length
  const tree = new Array<Hex>(2 * n - 1)
  for (let i = 0; i < n; i++) {
    tree[tree.length - 1 - i] = sorted[i]!.hash
  }
  for (let i = tree.length - 1 - n; i >= 0; i--) {
    tree[i] = standardNodeHash(tree[2 * i + 1]!, tree[2 * i + 2]!)
  }

  // 3) 原值索引 → 树节点位置（排序后叶子在堆尾部倒序排列）
  const treeIndexByValueIndex = new Map<number, number>()
  sorted.forEach(({ valueIndex }, leafIndex) => {
    treeIndexByValueIndex.set(valueIndex, tree.length - 1 - leafIndex)
  })

  const siblingIndex = (i: number): number => (i > 0 ? i - (-1) ** (i % 2) : -1)
  const parentIndex = (i: number): number => (i > 0 ? Math.floor((i - 1) / 2) : -1)

  return {
    root: tree[0]!,
    leafCount: n,
    getProof(valueIndex: number): Hex[] {
      let cur = treeIndexByValueIndex.get(valueIndex)
      if (cur === undefined) {
        throw new Error('Index out of bounds')
      }
      const proof: Hex[] = []
      while (cur > 0) {
        const sib = siblingIndex(cur)
        if (sib < 0 || sib >= tree.length) {
          throw new Error('Invalid tree state')
        }
        proof.push(tree[sib]!)
        cur = parentIndex(cur)
      }
      return proof
    },
  }
}

/**
 * 验证单叶证明（对应链上 OZ MerkleProof.verify 的 JS 侧等价校验）
 * @param root      Merkle Root
 * @param leafHash  叶子哈希（standardLeafHash 结果）
 * @param proof     兄弟节点路径
 */
export function verifyMerkleProof(root: Hex, leafHash: Hex, proof: readonly Hex[]): boolean {
  let hash = leafHash
  for (const p of proof) {
    hash = standardNodeHash(hash, p)
  }
  return hash === root
}
