// JNSVote (JNS 治理投票) 合约配置
// 合约地址: 0xEf1f38e95dd7F4FB564535F9317ecB3Bd419DA50 (mainnet)
// 来源: v1 deployments.js + jnsvote.sbt.js ABI（docs/reference/jnsvote/）
// 说明: JNSVote 是 SBT（不可转让），投票资格 = JTI 余额>0 且 JNS 余额>0，投票后 mint 1 枚参与徽章

export const JNSVOTE_ADDRESS = '0xEf1f38e95dd7F4FB564535F9317ecB3Bd419DA50' as const

// JTI (JTI 认证标识 V1) 合约
export const JTI_ADDRESS = '0x826971d988d7d86Fdc9062A3f63E7b18D32Bc8EB' as const

// 最小 ERC721 balanceOf ABI（JTI 资格检查用；JNS 已有完整 ABI 在 jns.ts）
export const jtiABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// JNSVote ABI - 只包含需要的函数
export const jnsVoteABI = [
  // 提案总数
  {
    inputs: [],
    name: '_totalProposals',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // 投票总数
  {
    inputs: [],
    name: '_totalVotes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // 提案详情（public mapping getter）
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: '_proposals',
    outputs: [
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'link', type: 'string' },
      { internalType: 'uint256', name: 'timeBegin', type: 'uint256' },
      { internalType: 'uint256', name: 'timeEnd', type: 'uint256' },
      { internalType: 'uint256', name: 'countVotesFor', type: 'uint256' },
      { internalType: 'uint256', name: 'countVotesAgainst', type: 'uint256' },
      { internalType: 'uint256', name: 'countJNSvoted', type: 'uint256' },
      { internalType: 'uint256', name: 'countJNSvotedFor', type: 'uint256' },
      { internalType: 'uint256', name: 'totalJNS', type: 'uint256' },
      { internalType: 'bool', name: 'disabled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // 单票详情（public mapping getter）
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: '_votes',
    outputs: [
      { internalType: 'uint256', name: 'proposal', type: 'uint256' },
      { internalType: 'uint256', name: 'voter', type: 'uint256' },
      { internalType: 'bool', name: 'isFor', type: 'bool' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'bytes32', name: 'hash', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // 某地址在某个提案是否已投票（public mapping getter，用于资格/已投状态）
  {
    inputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: '_jti_voted',
    outputs: [
      { internalType: 'uint256', name: 'proposal', type: 'uint256' },
      { internalType: 'uint256', name: 'voter', type: 'uint256' },
      { internalType: 'bool', name: 'isFor', type: 'bool' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'bytes32', name: 'hash', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // 投赞成票
  {
    inputs: [{ internalType: 'uint256', name: 'proposal', type: 'uint256' }],
    name: 'voteFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // 投反对票
  {
    inputs: [{ internalType: 'uint256', name: 'proposal', type: 'uint256' }],
    name: 'voteAgainst',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // ERC721: 徽章余额
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ERC721Enumerable: 徽章遍历
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ERC721: 徽章 metadata（base64 JSON + SVG）
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export type JNSVoteContract = typeof jnsVoteABI
