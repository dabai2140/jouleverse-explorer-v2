export const jouleverseChain = {
  id: 3666,
  name: 'Jouleverse Mainnet',
  nativeCurrency: {
    name: 'J',
    symbol: 'J',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.jnsdao.com:8503'] },
  },
  blockExplorers: {
    default: { name: 'JScan', url: 'https://jscan.jnsdao.com' },
  },
  // Multicall3 自部署（2026-08-11，部署账户 0xBE7b...98373）
  // 标准地址 0xcA11bde... 链上无合约，使用自部署地址
  contracts: {
    multicall3: {
      address: '0x52E8BB61d20259F0434Aefe0C2EfB48fDe77f9C2',
    },
  },
} as const;

export type Chain = typeof jouleverseChain;
