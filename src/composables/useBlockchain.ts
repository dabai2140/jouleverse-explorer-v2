import { ref } from 'vue';
import { createPublicClient, http } from 'viem';
import type { Block } from '@/types/block';
import { useBlockchainStore } from '@/stores/blockchain';

export function useBlockchain() {
  const store = useBlockchainStore();
  
  const client = ref<ReturnType<typeof createPublicClient> | null>(null);
  
  // 初始化客户端
  const initClient = () => {
    client.value = createPublicClient({
      transport: http('https://rpc.jnsdao.com:8503'),
    });
  };
  
  // 获取最新区块
  const fetchLatestBlocks = async (count: number = 10): Promise<Block[]> => {
    if (!client.value) initClient();
    
    store.setLoading(true);
    
    try {
      const latestBlock = await client.value!.getBlock({ blockTag: 'latest' });
      if (!latestBlock) return [];
      
      // 更新最新区块号
      store.setLatestBlock(Number(latestBlock.number));
      
      // 更新网络状态
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = currentTime - Number(latestBlock.timestamp);
      store.setNetworkStatus(timeDiff < 60 ? 'online' : 'offline');
      
      // 获取区块列表
      const fromRange = Math.max(0, Number(latestBlock.number) - count);
      const toRange = Number(latestBlock.number);
      
      const blocks: Block[] = [];
      for (let i = toRange; i >= fromRange; i--) {
        const block = await client.value!.getBlock({ blockNumber: BigInt(i) });
        if (block) {
          blocks.push({
            number: Number(block.number),
            hash: block.hash,
            timestamp: Number(block.timestamp),
            transactionCount: block.transactions.length,
            miner: block.miner,
          });
        }
      }
      
      return blocks;
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
      store.setNetworkStatus('offline');
      return [];
    } finally {
      store.setLoading(false);
    }
  };
  
  return {
    fetchLatestBlocks,
  };
}
