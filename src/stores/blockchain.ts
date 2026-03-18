import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useBlockchainStore = defineStore('blockchain', () => {
  const latestBlock = ref<number | null>(null);
  const networkStatus = ref<'online' | 'offline'>('online');
  const loading = ref(false);

  const setLatestBlock = (blockNumber: number) => {
    latestBlock.value = blockNumber;
  };

  const setNetworkStatus = (status: 'online' | 'offline') => {
    networkStatus.value = status;
  };

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  return {
    latestBlock,
    networkStatus,
    loading,
    setLatestBlock,
    setNetworkStatus,
    setLoading,
  };
});
