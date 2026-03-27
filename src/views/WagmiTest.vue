<template>
  <div class="wagmi-test">
    <h1>Wagmi WriteContract Test</h1>
    <div class="status">
      <p>WJ Address: {{ wjAddress }}</p>
      <p>ABI Type: {{ abiType }}</p>
      <p>Is Array: {{ isArray }}</p>
      <p>ABI Length: {{ abiLength }}</p>
      <p>Connected: {{ isConnected }}</p>
      <p>Address: {{ connectedAddress }}</p>
      <p>Chain ID: {{ chainId }}</p>
    </div>
    <div class="buttons">
      <button @click="connectWallet" class="btn" :disabled="isConnecting">{{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}</button>
      <button @click="switchChain" class="btn" :disabled="!isConnected">Switch to Jouleverse</button>
      <button @click="testWriteContract" class="btn" :disabled="!isConnected || isWriting">{{ isWriting ? 'Writing...' : 'Test Write Contract' }}</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="result" class="result">{{ result }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WJ_ADDRESS, wjABI } from '../contracts/wj'
import { parseEther } from 'viem'

const wjAddress = ref(WJ_ADDRESS)
const abiType = ref(typeof wjABI)
const isArray = ref(Array.isArray(wjABI))
const abiLength = ref(Array.isArray(wjABI) ? wjABI.length : 0)
const error = ref<string | null>(null)
const result = ref<string | null>(null)
const isConnected = ref(false)
const connectedAddress = ref<string | null>(null)
const chainId = ref<number | null>(null)
const isConnecting = ref(false)
const isWriting = ref(false)

onMounted(async () => {
  console.log('=== WagmiTest Mounted ===')
  console.log('wjABI:', wjABI)
  console.log('wjABI[0]:', wjABI[0])

  const { config: wagmiConfig } = await import('../stores/wallet')
  console.log('=== Wagmi Config ===')
  console.log('config:', wagmiConfig)
  console.log('config.chains:', wagmiConfig.chains)
  console.log('config.connectors:', wagmiConfig.connectors)
  console.log('config.connectors[0]:', wagmiConfig.connectors[0])
})

const connectWallet = async () => {
  error.value = null
  result.value = null
  isConnecting.value = true

  try {
    console.log('[1] Before connecting')

    const { connect, getAccount } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    console.log('[2] Connecting wallet...')
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0] })

    console.log('[3] Getting account...')
    const account = getAccount(wagmiConfig)

    console.log('[4] Account:', account)

    if (account.address) {
      isConnected.value = true
      connectedAddress.value = account.address
      chainId.value = account.chainId as number
      result.value = `Connected! Address: ${account.address}, Chain: ${account.chainId}`
    } else {
      error.value = 'No address found after connection'
    }
    console.log('[5] Connect completed')
  } catch (err) {
    console.error('Connect error:', err)
    console.error('Error message:', (err as Error).message)
    console.error('Error stack:', (err as Error).stack)
    error.value = (err as Error).message
  } finally {
    isConnecting.value = false
  }
}

const switchChain = async () => {
  error.value = null
  result.value = null

  try {
    console.log('[Switch1] Before switching chain')

    const { switchChain: wagmiSwitchChain } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    console.log('[Switch2] Switching to Jouleverse (chainId: 3666)...')
    await wagmiSwitchChain(wagmiConfig, { chainId: 3666 })

    console.log('[Switch3] Getting account...')
    const { getAccount } = await import('wagmi/actions')
    const account = getAccount(wagmiConfig)

    console.log('[Switch4] Account:', account)

    if (account.chainId) {
      chainId.value = account.chainId as number
      result.value = `Switched! Chain: ${account.chainId}`
    }
  } catch (err) {
    console.error('Switch chain error:', err)
    console.error('Error message:', (err as Error).message)
    console.error('Error stack:', (err as Error).stack)
    error.value = (err as Error).message
  }
}

const testWriteContract = async () => {
  error.value = null
  result.value = null
  isWriting.value = true

  try {
    console.log('[1] Before importing')

    const { writeContract } = await import('wagmi/actions')
    const { config: wagmiConfig } = await import('../stores/wallet')

    console.log('[2] wjABI type:', typeof wjABI)
    console.log('[3] wjABI is array:', Array.isArray(wjABI))
    console.log('[4] wjABI value:', wjABI)

    const testAbi = JSON.parse(JSON.stringify(wjABI))
    console.log('[5] testAbi type:', typeof testAbi)
    console.log('[6] testAbi is array:', Array.isArray(testAbi))

    const targetAddress = connectedAddress.value || '0x0000000000000000000000000000000000000000'
    const amount = parseEther('1')

    console.log('[7] Before writeContract')
    console.log('[7.1] WJ_ADDRESS:', WJ_ADDRESS)
    console.log('[7.2] targetAddress:', targetAddress)
    console.log('[7.3] amount:', amount)
    console.log('[7.4] functionName:', 'withdrawTo')
    console.log('[7.5] args:', [targetAddress, amount])

    const hash = await writeContract(wagmiConfig, {
      address: WJ_ADDRESS,
      abi: testAbi,
      functionName: 'withdrawTo',
      args: [targetAddress as `0x${string}`, amount],
    })

    console.log('[8] After writeContract:', hash)

    result.value = `Success! Hash: ${hash}`
  } catch (err) {
    console.error('Error:', err)
    console.error('Error message:', (err as Error).message)
    console.error('Error stack:', (err as Error).stack)
    error.value = (err as Error).message
  } finally {
    isWriting.value = false
  }
}
</script>

<style scoped>
.wagmi-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.status {
  background: #f0f9ff;
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
}

.status p {
  margin: 8px 0;
}

.buttons {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.btn {
  background: #3b82f6;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.btn:hover:not(:disabled) {
  background: #2563eb;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  background: #fee2e2;
  color: #dc2626;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
  word-break: break-word;
}

.result {
  background: #dcfce7;
  color: #16a34a;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
  word-break: break-word;
}
</style>
