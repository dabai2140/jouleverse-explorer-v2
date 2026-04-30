<template>
  <div class="jns-query">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1>🔍 JNS 域名查询</h1>
    </div>

    <!-- 搜索框 -->
    <div class="search-section">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          @keyup.enter="searchDomain"
          type="text" 
          placeholder="输入 JNS 域名 (例如: xxx.j)"
          class="search-input"
          :disabled="loading"
        >
        <button @click="searchDomain" class="search-btn" :disabled="loading || !searchQuery">
          {{ loading ? '查询中...' : '查询' }}
        </button>
      </div>
      <p class="search-hint">域名必须以 .j 结尾</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <!-- 域名信息 -->
    <div v-if="domainInfo" class="domain-info">
      <!-- 域名卡片 -->
      <div class="domain-card">
        <div class="domain-header">
          <div v-if="domainInfo.logo" class="domain-logo" v-html="domainInfo.logo"></div>
          <div class="domain-title">
            <h2>{{ domainInfo.name }}.j</h2>
            <span class="domain-status" :class="{ 'bound': domainInfo.isBound, 'unbound': !domainInfo.isBound }">
              {{ domainInfo.isBound ? '✅ 已绑定' : '⚠️ 未绑定' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 详细信息 -->
      <div class="info-section">
        <h3>📋 基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Token ID</span>
            <span class="value">{{ domainInfo.tokenId }}</span>
          </div>
          <div class="info-item">
            <span class="label">域名名称</span>
            <span class="value">{{ domainInfo.name }}.j</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>👤 NFT 所有者</h3>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">所有者地址</span>
            <span class="value hash">{{ formatAddress(domainInfo.owner) }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>🔗 绑定信息</h3>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">绑定钱包地址</span>
            <span class="value hash" :class="{ 'unbound-address': !domainInfo.isBound }">
              {{ domainInfo.isBound ? formatAddress(domainInfo.boundAddress) : '未绑定到任何地址' }}
            </span>
          </div>
        </div>
        <div class="info-note">
          <p>💡 JNS 域名可以绑定到一个钱包地址，实现域名解析功能。绑定后可通过地址反向查询域名。</p>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <button @click="goToAddress(domainInfo.owner)" class="action-btn">
          查看所有者详情
        </button>
        <button v-if="domainInfo.isBound" @click="goToAddress(domainInfo.boundAddress)" class="action-btn">
          查看绑定地址详情
        </button>
      </div>
    </div>

    <!-- 地址反查区域 -->
    <div class="reverse-lookup-section">
      <h3>🔄 地址反查</h3>
      <p class="hint">输入钱包地址查询其绑定的 JNS 域名</p>
      <div class="reverse-search-box">
        <input 
          v-model="reverseQuery" 
          @keyup.enter="reverseLookup"
          type="text" 
          placeholder="输入钱包地址"
          class="search-input"
          :disabled="reverseLoading"
        >
        <button @click="reverseLookup" class="search-btn" :disabled="reverseLoading || !reverseQuery">
          {{ reverseLoading ? '查询中...' : '反查' }}
        </button>
      </div>
      <div v-if="reverseResult" class="reverse-result">
        <p>该地址绑定的域名：<strong>{{ reverseResult }}.j</strong></p>
        <button @click="searchDomainByName(reverseResult)" class="action-btn small">
          查看详情
        </button>
      </div>
      <div v-if="reverseError" class="error-message small">
        <p>{{ reverseError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createPublicClient, http } from 'viem'
import { JNS_ADDRESS, jnsABI } from '@/contracts/jns'
import { jouleverseChain } from '@/config/chain'

const router = useRouter()

// 搜索状态
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const domainInfo = ref<{
  name: string
  tokenId: number
  owner: string
  boundAddress: string
  isBound: boolean
  logo: string
} | null>(null)

// 反查状态
const reverseQuery = ref('')
const reverseLoading = ref(false)
const reverseError = ref('')
const reverseResult = ref('')

// 创建 public client
const publicClient = createPublicClient({
  transport: http(jouleverseChain.rpcUrls.default.http[0]),
})

// 格式化地址
const formatAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// 搜索域名
const searchDomain = async () => {
  if (!searchQuery.value) return
  
  const query = searchQuery.value.trim().toLowerCase()
  
  // 验证格式
  if (!query.endsWith('.j')) {
    error.value = '域名必须以 .j 结尾'
    domainInfo.value = null
    return
  }
  
  const name = query.slice(0, -2) // 去掉 .j 后缀
  if (name.length === 0) {
    error.value = '请输入有效的域名'
    domainInfo.value = null
    return
  }

  loading.value = true
  error.value = ''
  domainInfo.value = null
  
  try {
    // 查询 tokenId
    const tokenId = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: '_nslookup',
      args: [name]
    }) as bigint
    
    if (tokenId === BigInt(0)) {
      error.value = `域名 ${query} 不存在`
      return
    }
    
    // 查询 NFT 所有者
    const owner = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: 'ownerOf',
      args: [tokenId]
    }) as string
    
    // 查询绑定的地址
    const boundAddress = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: '_bound',
      args: [tokenId]
    }) as string
    
    // 获取 tokenURI (SVG logo)
    const tokenURI = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: 'tokenURI',
      args: [tokenId]
    }) as string
    
    // 解析 SVG (data:image/svg+xml;base64,...)
    let logo = ''
    if (tokenURI.startsWith('data:image/svg+xml;base64,')) {
      const base64 = tokenURI.split(',')[1]
      try {
        const svg = atob(base64)
        logo = svg
      } catch (e) {
        console.error('Failed to decode SVG:', e)
      }
    }
    
    domainInfo.value = {
      name,
      tokenId: Number(tokenId),
      owner,
      boundAddress,
      isBound: boundAddress !== '0x0000000000000000000000000000000000000000',
      logo
    }
    
  } catch (e: any) {
    console.error('JNS query error:', e)
    error.value = `查询失败: ${e.message || '未知错误'}`
    domainInfo.value = null
  } finally {
    loading.value = false
  }
}

// 反查域名
const reverseLookup = async () => {
  if (!reverseQuery.value) return
  
  const address = reverseQuery.value.trim()
  
  // 简单验证地址格式
  if (!address.startsWith('0x') || address.length !== 42) {
    reverseError.value = '请输入有效的以太坊地址'
    reverseResult.value = ''
    return
  }
  
  reverseLoading.value = true
  reverseError.value = ''
  reverseResult.value = ''
  
  try {
    const name = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: 'addr2name',
      args: [address as `0x${string}`]
    }) as string
    
    if (name) {
      reverseResult.value = name
    } else {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    }
  } catch (e: any) {
    if (e.message && e.message.includes('address without bound JNS')) {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    } else {
      reverseError.value = `反查失败: ${e.message || '未知错误'}`
    }
    reverseResult.value = ''
  } finally {
    reverseLoading.value = false
  }
}

// 跳转到地址详情页
const goToAddress = (address: string) => {
  router.push(`/address/${address}`)
}

// 通过名称直接查询（用于反查后的操作）
const searchDomainByName = (name: string) => {
  searchQuery.value = name + '.j'
  searchDomain()
}

// 从 URL 获取查询参数
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
  const domain = route.query.domain as string
  if (domain) {
    searchQuery.value = domain
    searchDomain()
  }
})
</script>

<style scoped>
.jns-query {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 24px;
}

.back-btn {
  background: #f5f5f5;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 12px;
  font-size: 14px;
}

.back-btn:hover {
  background: #e0e0e0;
}

h1 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

/* 搜索区域 */
.search-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
}

.search-input:focus {
  outline: none;
  border-color: #04aa6d;
}

.search-btn {
  padding: 12px 24px;
  background: #04aa6d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.search-btn:hover:not(:disabled) {
  background: #039963;
}

.search-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.search-hint {
  margin-top: 8px;
  color: #666;
  font-size: 13px;
}

/* 错误提示 */
.error-message {
  background: #fff3f3;
  border: 1px solid #ffcdd2;
  color: #c62828;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.error-message.small {
  padding: 8px 12px;
  font-size: 14px;
}

/* 域名信息 */
.domain-info {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.domain-card {
  background: linear-gradient(135deg, #04aa6d 0%, #038c5a 100%);
  color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.domain-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.domain-logo {
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.domain-logo :deep(svg) {
  width: 100%;
  height: 100%;
}

.domain-title h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
}

.domain-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  background: rgba(255,255,255,0.2);
}

.domain-status.bound {
  background: rgba(255,255,255,0.3);
}

.domain-status.unbound {
  background: rgba(0,0,0,0.2);
}

/* 信息区域 */
.info-section {
  margin-bottom: 20px;
}

.info-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 8px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item .label {
  display: block;
  color: #666;
  font-size: 13px;
  margin-bottom: 4px;
}

.info-item .value {
  font-size: 15px;
  color: #333;
  word-break: break-all;
}

.info-item .value.hash {
  font-family: monospace;
  font-size: 13px;
}

.info-item .value.unbound-address {
  color: #999;
  font-style: italic;
}

.info-note {
  margin-top: 12px;
  padding: 10px 14px;
  background: #e8f5e9;
  border-radius: 6px;
  font-size: 13px;
  color: #555;
}

/* 操作按钮 */
.action-section {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  padding: 12px 20px;
  background: #04aa6d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.action-btn:hover {
  background: #039963;
}

.action-btn.small {
  padding: 8px 16px;
  font-size: 13px;
  margin-top: 10px;
}

/* 反查区域 */
.reverse-lookup-section {
  margin-top: 24px;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
}

.reverse-lookup-section h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #333;
}

.reverse-lookup-section .hint {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 13px;
}

.reverse-search-box {
  display: flex;
  gap: 10px;
}

.reverse-result {
  margin-top: 16px;
  padding: 12px 16px;
  background: #e8f5e9;
  border-radius: 8px;
}

.reverse-result p {
  margin: 0;
  font-size: 14px;
}

.reverse-result strong {
  color: #04aa6d;
}
</style>
