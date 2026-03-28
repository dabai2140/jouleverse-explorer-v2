<script setup lang="ts">
import { onMounted } from 'vue'
import { useWalletStore } from './stores/wallet'

const walletStore = useWalletStore()

const handleConnect = async () => {
  try {
    await walletStore.connect()
  } catch (error) {
    alert('连接钱包失败，请检查 MetaMask 是否已安装')
  }
}

const handleDisconnect = async () => {
  await walletStore.disconnect()
}

// 页面加载时检查是否已连接
onMounted(() => {
  walletStore.checkConnection()
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <router-link to="/" class="logo">
          <svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <circle cx="256" cy="256" r="256" fill="#EB1727"/>
            <path fill="#fefefe" d="M202.4025 130.5h127.195q.2 75-.5 150-5 79.5-82.5 97.5-34.4 6.2-68-3-54.3-18.8-64.5-75.5a133 133 0 0 1-2.5-28h56q3.2 66.9 69 55.5 27-8 33.5-35.5.3-4.3 2-13 .7-49 .5-98a1260 1260 0 0 0-71-1M305.6 226l60 100 60-100"/>
          </svg>
          <span class="logo-text">Jscan <span class="beta-tag">V2 Beta</span></span>
        </router-link>
      </div>

      <div class="header-right">
        <!-- 钱包连接区域 -->
        <div v-if="walletStore.isConnected" class="wallet-info">
          <div class="wallet-details">
            <span class="wallet-address">
              {{ walletStore.formatAddress(walletStore.address) }}
            </span>
            <span class="wallet-balance">
              {{ walletStore.formatBalance(walletStore.balance) }} J
            </span>
          </div>
          <button @click="handleDisconnect" class="btn-disconnect">
            断开
          </button>
        </div>
        <button 
          v-else 
          @click="handleConnect" 
          :disabled="walletStore.isConnecting"
          class="btn-connect"
        >
          {{ walletStore.isConnecting ? '连接中...' : '🔐 连接钱包' }}
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.app-header {
  background: white;
  border-bottom: 2px solid #e2e8f0;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.logo svg {
  flex-shrink: 0;
}

.logo-text {
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 700;
}

.beta-tag {
  font-size: 0.75rem;
  font-weight: 500;
  background: #dbeafe;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 6px;
}

.header-right {
  display: flex;
  align-items: center;
}

/* Wallet Info */
.wallet-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wallet-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.wallet-address {
  font-family: 'Courier New', monospace;
  color: #1e293b;
  font-weight: 600;
  font-size: 0.9rem;
}

.wallet-balance {
  color: #64748b;
  font-size: 0.85rem;
}

/* Buttons */
.btn-connect {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-connect:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-connect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-disconnect {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-disconnect:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

/* Main Content */
.app-main {
  flex: 1;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f1f5f9;
  color: #1e293b;
}

#app {
  min-height: 100vh;
}
</style>
