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
} as const;

export type Chain = typeof jouleverseChain;
