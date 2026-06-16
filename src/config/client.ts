import { createPublicClient, http } from 'viem'
import { jouleverseChain } from './chain'

export const publicClient = createPublicClient({ chain: jouleverseChain, transport: http() })
