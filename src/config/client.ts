import { createPublicClient, http, webSocket } from 'viem'
import { jouleverseChain } from './chain'

export const publicClient = createPublicClient({ chain: jouleverseChain, transport: http() })

// WebSocket 客户端：用于首页新区块实时推送（wss 端点 /ws）
// 断线自动重连 10 次，间隔 3s（viem 内置指数退避）
export const wsPublicClient = createPublicClient({
  chain: jouleverseChain,
  transport: webSocket('wss://rpc.jnsdao.com/ws', { retryCount: 10, retryDelay: 3000 }),
})
